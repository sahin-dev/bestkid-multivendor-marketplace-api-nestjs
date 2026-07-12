import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOrderDto } from "./dtos/create-order.dto";
import { BuyerOrderTab, OrderQueryDto, SellerOrderTab } from "./dtos/order-query.dto";
import { CheckoutDto } from "./dtos/checkout.dto";
import { DeliveryService } from "../delivery/delivery.service";
import { OrderCancellationActor, OrderStatus, NotificationType } from "generated/prisma/client";
import { NotificationService } from "../notification/notification.service";
import { CreateReviewDto } from "../product/dtos/create-review.dto";
import { ChatService } from "../chat/chat.service";
import { assertEntityExists } from "src/common/validators/entity-exists.validator";

@Injectable()
export class OrderService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly deliveryService: DeliveryService,
        private readonly notificationService: NotificationService,
        private readonly chatService: ChatService,
    ) {}

    async createOrder(userId: number, dto: CreateOrderDto) {
        if (!dto.items || dto.items.length === 0) {
            throw new BadRequestException("Order must contain at least one item");
        }
        await assertEntityExists(this.prismaService.baseUser, "User", userId);

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
                    user: {
                        select: {
                            id: true,
                            email: true,
                            profile: { select: { full_name: true, avatar_url: true, phone: true } },
                        },
                    },
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
        const { page = 1, limit = 10, status, tab } = query;
        const skip = (page - 1) * limit;

        const whereClause: any = { userId };
        if (status) {
            whereClause.status = status;
        } else if (tab) {
            whereClause.status = { in: this.getStatusesForBuyerTab(tab) };
        }

        const [data, total] = await Promise.all([
            this.prismaService.order.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: {
                    seller: {
                        select: {
                            id: true,
                            email: true,
                            profile: { select: { full_name: true, avatar_url: true, country: true } },
                        },
                    },
                    items: {
                        include: {
                            product: { select: { id: true, name: true, image_urls: true } },
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
            }),
            this.prismaService.order.count({ where: whereClause }),
        ]);

        return {
            data: data.map((order) => this.formatOrderCard(order)),
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async findAllSellerOrders(sellerId: number, query: OrderQueryDto) {
        const { page = 1, limit = 10, status, sellerTab } = query;
        const skip = (page - 1) * limit;

        const whereClause: any = { sellerId };
        if (status) {
            whereClause.status = status;
        } else if (sellerTab) {
            whereClause.status = { in: this.getStatusesForSellerTab(sellerTab) };
        }

        const [data, total] = await Promise.all([
            this.prismaService.order.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            profile: { select: { full_name: true, avatar_url: true, phone: true } },
                        },
                    },
                    items: {
                        include: {
                            product: { select: { id: true, name: true, image_urls: true } },
                            variant: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
            }),
            this.prismaService.order.count({ where: whereClause }),
        ]);

        return {
            data: data.map((order) => this.formatSellerOrderCard(order)),
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
            include: this.getOrderDetailInclude(),
        });

        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found`);
        }

        if (userId !== undefined && !isAdmin && order.userId !== userId && order.sellerId !== userId) {
            throw new ForbiddenException("You do not have permission to access this order");
        }

        return this.formatOrderDetail(order);
    }

    async findSellerOrderById(orderId: number, sellerId: number) {
        const order = await this.prismaService.order.findUnique({
            where: { id: orderId },
            include: this.getOrderDetailInclude(),
        });

        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found`);
        }

        if (order.sellerId !== sellerId) {
            throw new ForbiddenException("You do not have permission to access this order");
        }

        return this.formatSellerOrderDetail(order);
    }

    async findOrCreateOrderChat(orderId: number, userId: number) {
        const order = await this.prismaService.order.findUnique({ where: { id: orderId } });
        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found`);
        }

        if (order.userId !== userId && order.sellerId !== userId) {
            throw new ForbiddenException("You do not have permission to access this order conversation");
        }

        return this.chatService.findOrCreateRoom(order.userId, order.sellerId);
    }

    async cancelOrder(orderId: number, userId: number, reason?: string) {
        const order = await this.findOrderById(orderId, userId);

        if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
            throw new BadRequestException(`Order cannot be cancelled in its current status: ${order.status}`);
        }

        const updated = await this.prismaService.order.update({
            where: { id: orderId },
            data: {
                status: OrderStatus.CANCELLED,
                cancelled_at: new Date(),
                cancelled_by_user_id: userId,
                cancelled_by_actor: OrderCancellationActor.BUYER,
                cancellation_reason: reason,
            },
            include: this.getOrderDetailInclude(),
        });

        try {
            await this.notificationService.create(
                updated.sellerId,
                "Order Cancelled",
                `Order #${updated.id} has been cancelled by the buyer.`,
                NotificationType.ORDER,
            );
        } catch (e) {
            console.error("Failed to send cancellation notification", e);
        }

        return this.formatOrderDetail(updated);
    }

    async reviewOrderItem(userId: number, orderItemId: number, dto: CreateReviewDto) {
        await assertEntityExists(this.prismaService.baseUser, "User", userId);
        this.assertReviewTextWithinWordLimit(dto.review);

        const orderItem = await this.prismaService.orderItem.findUnique({
            where: { id: orderItemId },
            include: {
                order: true,
                product: true,
                review: true,
            },
        });

        if (!orderItem) {
            throw new NotFoundException(`Order item with ID ${orderItemId} not found`);
        }

        if (orderItem.order.userId !== userId) {
            throw new ForbiddenException("You do not own this order item");
        }

        if (orderItem.order.status !== OrderStatus.DELIVERED) {
            throw new BadRequestException("You can review an item only after the order is delivered");
        }

        if (orderItem.review) {
            throw new BadRequestException("This order item has already been reviewed");
        }

        const review = await this.prismaService.$transaction(async (tx) => {
            const created = await tx.productReview.create({
                data: {
                    productId: orderItem.productId,
                    orderItemId,
                    userId,
                    rating: dto.rating,
                    review: dto.review,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            profile: { select: { full_name: true, avatar_url: true } },
                        },
                    },
                },
            });

            const aggregates = await tx.productReview.aggregate({
                where: { productId: orderItem.productId },
                _count: { id: true },
                _avg: { rating: true },
            });

            await tx.product.update({
                where: { id: orderItem.productId },
                data: {
                    total_reviews: aggregates._count.id,
                    average_rating: aggregates._avg.rating ?? 0,
                },
            });

            return created;
        });

        return review;
    }

    async updateSellerOrderStatus(orderId: number, sellerId: number, status: OrderStatus) {
        const order = await this.prismaService.order.findFirst({
            where: { id: orderId, sellerId },
        });

        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found for this seller`);
        }

        const validTransitions: Record<OrderStatus, OrderStatus[]> = {
            [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
            [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.CANCELLED],
            [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED],
            [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
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
            data: {
                status,
                ...this.getOrderTimelineUpdate(status),
                ...(status === OrderStatus.CANCELLED
                    ? {
                          cancelled_at: new Date(),
                          cancelled_by_user_id: sellerId,
                          cancelled_by_actor: OrderCancellationActor.SELLER,
                      }
                    : {}),
            },
            include: this.getOrderDetailInclude(),
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

        return this.formatSellerOrderDetail(updated);
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
            data: {
                status,
                ...this.getOrderTimelineUpdate(status),
                ...(status === OrderStatus.CANCELLED
                    ? {
                          cancelled_at: new Date(),
                          cancelled_by_actor: OrderCancellationActor.ADMIN,
                      }
                    : {}),
            },
            include: this.getOrderDetailInclude(),
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

    private getStatusesForBuyerTab(tab: BuyerOrderTab) {
        const tabMap: Record<BuyerOrderTab, OrderStatus[]> = {
            [BuyerOrderTab.ACTIVE]: [
                OrderStatus.PENDING,
                OrderStatus.CONFIRMED,
                OrderStatus.PROCESSING,
                OrderStatus.SHIPPED,
            ],
            [BuyerOrderTab.COMPLETE]: [OrderStatus.DELIVERED],
            [BuyerOrderTab.CANCELED]: [OrderStatus.CANCELLED],
        };

        return tabMap[tab];
    }

    private getStatusesForSellerTab(tab: SellerOrderTab) {
        const tabMap: Record<SellerOrderTab, OrderStatus[]> = {
            [SellerOrderTab.ORDER_PLACED]: [OrderStatus.PENDING],
            [SellerOrderTab.CONFIRMED]: [OrderStatus.CONFIRMED],
            [SellerOrderTab.SHIPPED]: [OrderStatus.PROCESSING, OrderStatus.SHIPPED],
            [SellerOrderTab.DELIVERED]: [OrderStatus.DELIVERED],
            [SellerOrderTab.CANCELED]: [OrderStatus.CANCELLED],
        };

        return tabMap[tab];
    }

    private getOrderTimelineUpdate(status: OrderStatus) {
        const now = new Date();
        if (status === OrderStatus.CONFIRMED) {
            return { confirmed_at: now };
        }
        if (status === OrderStatus.PROCESSING) {
            return { processing_at: now };
        }
        if (status === OrderStatus.SHIPPED) {
            return { shipped_at: now };
        }
        if (status === OrderStatus.DELIVERED) {
            return { delivered_at: now };
        }
        return {};
    }

    private getOrderDetailInclude() {
        return {
            user: {
                select: {
                    id: true,
                    email: true,
                    profile: { select: { full_name: true, avatar_url: true, phone: true, country: true } },
                },
            },
            seller: {
                select: {
                    id: true,
                    email: true,
                    profile: { select: { full_name: true, avatar_url: true, phone: true, country: true } },
                },
            },
            items: {
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            image_urls: true,
                            average_rating: true,
                            total_reviews: true,
                        },
                    },
                    variant: true,
                    returnRequests: { orderBy: { createdAt: "desc" as const }, take: 1 },
                    review: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    profile: { select: { full_name: true, avatar_url: true } },
                                },
                            },
                        },
                    },
                },
            },
        };
    }

    private formatOrderCard(order: any) {
        return {
            id: order.id,
            display_id: this.getDisplayOrderId(order.id),
            status: order.status,
            status_label: this.getStatusLabel(order.status),
            status_tone: this.getStatusTone(order.status),
            createdAt: order.createdAt,
            total: order.total,
            item_count: order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
            seller: order.seller,
            preview_items: order.items.slice(0, 2).map((item: any) => ({
                id: item.id,
                productId: item.productId,
                name: item.product?.name,
                image_url: item.product?.image_urls?.[0] ?? null,
                quantity: item.quantity,
                price: item.price,
            })),
            actions: {
                can_view_details: true,
                can_cancel: this.canCancelOrder(order.status),
            },
        };
    }

    private formatSellerOrderCard(order: any) {
        return {
            id: order.id,
            display_id: this.getDisplayOrderId(order.id),
            status: order.status,
            status_label: this.getStatusLabel(order.status),
            status_tone: this.getStatusTone(order.status),
            createdAt: order.createdAt,
            total: order.total,
            item_count: order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
            buyer: order.user,
            preview_items: order.items.slice(0, 2).map((item: any) => ({
                id: item.id,
                productId: item.productId,
                name: item.product?.name,
                image_url: item.product?.image_urls?.[0] ?? null,
                variant: item.variant,
                quantity: item.quantity,
                price: item.price,
            })),
            cancellation: this.getCancellationSummary(order),
            timeline: this.getTimelineSummary(order),
            actions: {
                can_view_details: true,
                can_update_status: this.canSellerUpdateStatus(order.status),
            },
        };
    }

    private formatOrderDetail(order: any) {
        return {
            id: order.id,
            display_id: this.getDisplayOrderId(order.id),
            status: order.status,
            status_label: this.getStatusLabel(order.status),
            status_tone: this.getStatusTone(order.status),
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            total: order.total,
            delivery: {
                partner: order.delivery_partner,
                cost: order.delivery_cost,
                days_min: order.delivery_days_min,
                days_max: order.delivery_days_max,
            },
            delivery_address: {
                address: order.shippingAddress,
                city: order.city,
                postal_code: order.postalCode,
                country: order.country,
            },
            buyer: order.user,
            seller: order.seller,
            cancellation: this.getCancellationSummary(order),
            timeline: this.getTimelineSummary(order),
            actions: {
                can_cancel: this.canCancelOrder(order.status),
            },
            items: order.items.map((item: any) => this.formatOrderItem(item, order.status)),
        };
    }

    private async formatSellerOrderDetail(order: any) {
        const chatRoomId = await this.getExistingChatRoomId(order.userId, order.sellerId);
        return {
            ...this.formatOrderDetail(order),
            chat_room_id: chatRoomId,
            ordered_by: order.user,
            actions: {
                can_update_status: this.canSellerUpdateStatus(order.status),
                can_message_buyer: true,
            },
            status_options: [
                OrderStatus.PENDING,
                OrderStatus.CONFIRMED,
                OrderStatus.SHIPPED,
                OrderStatus.DELIVERED,
                OrderStatus.CANCELLED,
            ],
        };
    }

    private formatOrderItem(item: any, orderStatus: OrderStatus) {
        const latestReturn = item.returnRequests?.[0] ?? null;
        return {
            id: item.id,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            price: item.price,
            line_total: item.price * item.quantity,
            product: item.product
                ? {
                      id: item.product.id,
                      name: item.product.name,
                      image_urls: item.product.image_urls,
                      image_url: item.product.image_urls?.[0] ?? null,
                      average_rating: item.product.average_rating,
                      total_reviews: item.product.total_reviews,
                  }
                : null,
            variant: item.variant
                ? { id: item.variant.id, variantName: item.variant.variantName, price: item.variant.price }
                : null,
            review: item.review ?? null,
            return_request: latestReturn,
            actions: {
                can_review: orderStatus === OrderStatus.DELIVERED && !item.review,
                reviewed: Boolean(item.review),
                can_return: orderStatus === OrderStatus.DELIVERED && !latestReturn,
                return_requested: Boolean(latestReturn),
            },
        };
    }

    private getDisplayOrderId(orderId: number) {
        return `KDF${String(orderId).padStart(10, "0")}`;
    }

    private getStatusLabel(status: OrderStatus) {
        const labels: Record<OrderStatus, string> = {
            [OrderStatus.PENDING]: "Order Placed",
            [OrderStatus.CONFIRMED]: "Confirmed",
            [OrderStatus.PROCESSING]: "Shipped",
            [OrderStatus.SHIPPED]: "Shipped",
            [OrderStatus.DELIVERED]: "Delivered",
            [OrderStatus.CANCELLED]: "Canceled",
            [OrderStatus.REFUNDED]: "Refunded",
        };

        return labels[status];
    }

    private getTimelineSummary(order: any) {
        return {
            confirmed_at: order.confirmed_at,
            processing_at: order.processing_at,
            shipped_at: order.shipped_at,
            delivered_at: order.delivered_at,
            cancelled_at: order.cancelled_at,
        };
    }

    private canSellerUpdateStatus(status: OrderStatus) {
        const finalStatuses: OrderStatus[] = [OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REFUNDED];
        return !finalStatuses.includes(status);
    }

    private async getExistingChatRoomId(buyerId: number, sellerId: number) {
        const room = await this.prismaService.chatRoom.findUnique({
            where: { buyerId_sellerId: { buyerId, sellerId } },
            select: { id: true },
        });
        return room?.id ?? null;
    }

    private getStatusTone(status: OrderStatus) {
        const tones: Record<OrderStatus, string> = {
            [OrderStatus.PENDING]: "info",
            [OrderStatus.CONFIRMED]: "primary",
            [OrderStatus.PROCESSING]: "warning",
            [OrderStatus.SHIPPED]: "warning",
            [OrderStatus.DELIVERED]: "success",
            [OrderStatus.CANCELLED]: "danger",
            [OrderStatus.REFUNDED]: "neutral",
        };

        return tones[status];
    }

    private canCancelOrder(status: OrderStatus) {
        return status === OrderStatus.PENDING || status === OrderStatus.CONFIRMED;
    }

    private getCancellationSummary(order: any) {
        if (order.status !== OrderStatus.CANCELLED) {
            return null;
        }

        const actor = order.cancelled_by_actor ?? OrderCancellationActor.SYSTEM;
        const labelMap: Record<OrderCancellationActor, string> = {
            [OrderCancellationActor.BUYER]: "You Canceled This Order",
            [OrderCancellationActor.SELLER]: "Seller Canceled This Order",
            [OrderCancellationActor.ADMIN]: "Admin Canceled This Order",
            [OrderCancellationActor.SYSTEM]: "This Order Was Canceled",
        };

        return {
            actor,
            message: labelMap[actor],
            cancelled_at: order.cancelled_at,
            cancelled_by_user_id: order.cancelled_by_user_id,
            reason: order.cancellation_reason,
        };
    }

    private assertReviewTextWithinWordLimit(review?: string) {
        if (!review) {
            return;
        }

        const wordCount = review.trim().split(/\s+/).filter(Boolean).length;
        if (wordCount > 100) {
            throw new BadRequestException("Review cannot be longer than 100 words");
        }
    }
}
