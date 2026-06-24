import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOrderDto } from "./dtos/create-order.dto";
import { OrderQueryDto } from "./dtos/order-query.dto";
import { OrderStatus } from "generated/prisma/client";

@Injectable()
export class OrderService {
    constructor(private readonly prismaService: PrismaService) {}

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

        if (userId !== undefined && !isAdmin && order.userId !== userId) {
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

        return this.prismaService.order.update({
            where: { id: orderId },
            data: { status },
            include: { items: true },
        });
    }
}
