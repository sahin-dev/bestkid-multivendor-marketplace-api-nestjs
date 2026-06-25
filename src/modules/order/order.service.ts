import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOrderDto } from "./dtos/create-order.dto";
import { OrderQueryDto } from "./dtos/order-query.dto";
import { CheckoutDto } from "./dtos/checkout.dto";
import { DeliveryService } from "../delivery/delivery.service";
import { OrderStatus, NotificationType } from "generated/prisma/client";
import { NotificationService } from "../notification/notification.service";

@Injectable()
export class OrderService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly deliveryService: DeliveryService,
        private readonly notificationService: NotificationService,
    ) {}

    async createOrder(userId: number, dto: CreateOrderDto) {
        if (!dto.items || dto.items.length === 0) {
            throw new BadRequestException("Order must contain at least one item");
        }

        // Fetch all product IDs from DB to verify and get prices
        const productIds = dto.items.map((i) => i.productId);
        const products = await this.prismaService.product.findMany({
            where: { id: { in: productIds } },
        });

        const productMap = new Map(products.map((p) => [p.id, p]));

        // Calculate totals and verify product existence
        let total = 0;
        const itemsToCreate: { productId: number; quantity: number; price: number }[] = [];

        for (const itemDto of dto.items) {
            const product = productMap.get(itemDto.productId);
            if (!product) {
                throw new NotFoundException(`Product with ID ${itemDto.productId} not found`);
            }
            if (product.status === "OUT_OF_STOCK" || product.status === "INACTIVE") {
                throw new BadRequestException(`Product ${product.name} is currently unavailable`);
            }

            const activePrice = product.discounted_price ?? product.original_price;
            const lineTotal = activePrice * itemDto.quantity;
            total += lineTotal;

            itemsToCreate.push({
                productId: itemDto.productId,
                quantity: itemDto.quantity,
                price: activePrice,
            });
        }

        // Create the order inside a database transaction
        return this.prismaService.$transaction(async (tx) => {
            const order = await tx.order.create({
                data: {
                    userId,
                    sellerId: products[0].userId, // Fallback sellerId for old createOrder endpoint
                    status: OrderStatus.PENDING,
                    total,
                    shippingAddress: dto.shippingAddress,
                    city: dto.city,
                    postalCode: dto.postalCode,
                    country: dto.country,
                    items: {
                        create: itemsToCreate,
                    },
                },
                include: {
                    items: true,
                },
            });

            return order;
        });
    }

    async checkoutFromCart(userId: number, dto: CheckoutDto) {
        // 1. Fetch user's cart with items, products, seller details, delivery option, and variant
        const cart = await this.prismaService.cart.findUnique({
            where: { userId },
            include: {
                cartItems: {
                    include: {
                        product: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        profile: { select: { country: true } },
                                        delivery_option: true,
                                        stripe_onboarding_complete: true,
                                    },
                                },
                            },
                        },
                        variant: true,
                    },
                },
            },
        });

        if (!cart || cart.cartItems.length === 0) {
            throw new BadRequestException("Cart is empty");
        }

        // 2. Validate items are ACTIVE and sellers have completed Stripe onboarding
        for (const item of cart.cartItems) {
            if (item.product.status !== "ACTIVE") {
                throw new BadRequestException(`Product ${item.product.name} is not active`);
            }
            if (!item.product.user.stripe_onboarding_complete) {
                throw new ForbiddenException(`Seller of product ${item.product.name} has not completed payment setup.`);
            }
        }

        // 3. Group by seller
        const sellerGroups = new Map<number, typeof cart.cartItems>();
        for (const item of cart.cartItems) {
            const sellerId = item.product.userId;
            if (!sellerGroups.has(sellerId)) {
                sellerGroups.set(sellerId, []);
            }
            sellerGroups.get(sellerId)!.push(item);
        }

        const createdOrders: any[] = [];

        // 4. Create orders in a transaction
        await this.prismaService.$transaction(async (tx) => {
            for (const [sellerId, items] of sellerGroups) {
                const seller = items[0].product.user;
                const sellerCountry = seller.profile?.country ?? null;

                // Resolve delivery
                const delivery = this.deliveryService.resolveDelivery(
                    seller.delivery_option,
                    dto.country,
                    sellerCountry,
                );

                const subtotal = items.reduce((sum, item) => {
                    const price = item.product.discounted_price ?? item.product.original_price;
                    return sum + price * item.quantity;
                }, 0);

                const total = subtotal + delivery.cost;

                const order = await tx.order.create({
                    data: {
                        userId,
                        sellerId,
                        status: OrderStatus.PENDING,
                        total,
                        delivery_partner: delivery.partner,
                        delivery_cost: delivery.cost,
                        delivery_days_min: delivery.days_min,
                        delivery_days_max: delivery.days_max,
                        shippingAddress: dto.shippingAddress,
                        city: dto.city,
                        postalCode: dto.postalCode,
                        country: dto.country,
                        items: {
                            create: items.map((item) => ({
                                productId: item.productId,
                                variantId: item.variantId,
                                quantity: item.quantity,
                                price: item.product.discounted_price ?? item.product.original_price,
                            })),
                        },
                    },
                    include: {
                        items: true,
                    },
                });

                createdOrders.push(order);
            }

            // 5. Clear the cart
            await tx.cartItem.deleteMany({
                where: { cartId: cart.id },
            });
        });

        // Send notifications
        for (const order of createdOrders) {
            try {
                await this.notificationService.create(
                    order.userId,
                    "Order Placed",
                    `Your order #${order.id} has been placed successfully.`,
                    NotificationType.ORDER,
                );
                await this.notificationService.create(
                    order.sellerId,
                    "New Order Received",
                    `You have received a new order #${order.id}.`,
                    NotificationType.ORDER,
                );
            } catch (e) {
                console.error("Failed to send order notification", e);
            }
        }

        return { orders: createdOrders };
    }

    async findAllUserOrders(userId: number, query: OrderQueryDto) {
        const { page = 1, limit = 10, status } = query;
        const skip = (page - 1) * limit;

        const whereClause: any = { userId };
        if (status) {
            whereClause.status = status;
        }

        const [data, total] = await Promise.all([
            this.prismaService.order.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: {
                    items: true,
                },
                orderBy: {
                    createdAt: "desc",
                },
            }),
            this.prismaService.order.count({ where: whereClause }),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async findAllSellerOrders(sellerId: number, query: OrderQueryDto) {
        const { page = 1, limit = 10, status } = query;
        const skip = (page - 1) * limit;

        const whereClause: any = { sellerId };
        if (status) {
            whereClause.status = status;
        }

        const [data, total] = await Promise.all([
            this.prismaService.order.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: {
                    items: true,
                },
                orderBy: {
                    createdAt: "desc",
                },
            }),
            this.prismaService.order.count({ where: whereClause }),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async findOrderById(orderId: number, userId?: number, isAdmin = false) {
        const order = await this.prismaService.order.findUnique({
            where: { id: orderId },
            include: {
                items: true,
            },
        });

        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found`);
        }

        if (userId !== undefined && !isAdmin && order.userId !== userId && order.sellerId !== userId) {
            throw new ForbiddenException("You do not have permission to access this order");
        }

        return order;
    }

    async findSellerOrderById(orderId: number, sellerId: number) {
        const order = await this.prismaService.order.findUnique({
            where: { id: orderId },
            include: {
                items: true,
            },
        });

        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found`);
        }

        if (order.sellerId !== sellerId) {
            throw new ForbiddenException("You do not have permission to access this order");
        }

        return order;
    }

    async cancelOrder(orderId: number, userId: number) {
        const order = await this.findOrderById(orderId, userId);

        if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
            throw new BadRequestException(`Order cannot be cancelled in its current status: ${order.status}`);
        }

        return this.prismaService.order.update({
            where: { id: orderId },
            data: { status: OrderStatus.CANCELLED },
            include: { items: true },
        });
    }

    async updateSellerOrderStatus(orderId: number, sellerId: number, status: OrderStatus) {
        const order = await this.prismaService.order.findFirst({
            where: { id: orderId, sellerId },
        });

        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found for this seller`);
        }

        const validTransitions: Record<OrderStatus, OrderStatus[]> = {
            [OrderStatus.PENDING]: [OrderStatus.CONFIRMED],
            [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING],
            [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED],
            [OrderStatus.SHIPPED]: [],
            [OrderStatus.DELIVERED]: [],
            [OrderStatus.CANCELLED]: [],
            [OrderStatus.REFUNDED]: [],
        };

        const allowed = validTransitions[order.status] || [];
        if (!allowed.includes(status)) {
            throw new BadRequestException(
                `Invalid status transition from ${order.status} to ${status} for seller.`,
            );
        }

        const updated = await this.prismaService.order.update({
            where: { id: orderId },
            data: { status },
            include: { items: true },
        });

        // Notify buyer
        try {
            await this.notificationService.create(
                updated.userId,
                "Order Status Updated",
                `Your order #${updated.id} status has been changed to ${status}.`,
                NotificationType.ORDER,
            );
        } catch (e) {
            console.error("Failed to send status update notification", e);
        }

        return updated;
    }

    async findAllOrdersAdmin(query: OrderQueryDto) {
        const { page = 1, limit = 10, status } = query;
        const skip = (page - 1) * limit;

        const whereClause: any = {};
        if (status) {
            whereClause.status = status;
        }

        const [data, total] = await Promise.all([
            this.prismaService.order.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: {
                    items: true,
                },
                orderBy: {
                    createdAt: "desc",
                },
            }),
            this.prismaService.order.count({ where: whereClause }),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async updateOrderStatusAdmin(orderId: number, status: OrderStatus) {
        const order = await this.prismaService.order.findUnique({ where: { id: orderId } });
        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found`);
        }

        const updated = await this.prismaService.order.update({
            where: { id: orderId },
            data: { status },
            include: { items: true },
        });

        // Notify buyer and seller
        try {
            await this.notificationService.create(
                updated.userId,
                "Order Status Updated (Admin)",
                `Your order #${updated.id} status has been changed to ${status} by admin.`,
                NotificationType.ORDER,
            );
            await this.notificationService.create(
                updated.sellerId,
                "Order Status Updated (Admin)",
                `Order #${updated.id} status has been changed to ${status} by admin.`,
                NotificationType.ORDER,
            );
        } catch (e) {
            console.error("Failed to send status update notification", e);
        }

        return updated;
    }
}
