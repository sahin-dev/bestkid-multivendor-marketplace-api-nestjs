import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReturnDto } from "./dtos/create-return.dto";
import { ReturnQueryDto } from "./dtos/return-query.dto";
import { ReturnStatus, NotificationType } from "generated/prisma/client";
import { NotificationService } from "../notification/notification.service";

@Injectable()
export class ReturnService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly notificationService: NotificationService,
    ) {}

    async createReturn(userId: number, dto: CreateReturnDto) {
        // Find the order item and its parent order
        const orderItem = await this.prismaService.orderItem.findUnique({
            where: { id: dto.orderItemId },
            include: { order: true },
        });

        if (!orderItem) {
            throw new NotFoundException(`Order item with ID ${dto.orderItemId} not found`);
        }

        // Validate buyer ownership
        if (orderItem.order.userId !== userId) {
            throw new ForbiddenException("You do not own this order item");
        }

        // Check if return request already exists
        const existing = await this.prismaService.returnRequest.findFirst({
            where: { orderItemId: dto.orderItemId },
        });
        if (existing) {
            throw new BadRequestException("A return request already exists for this order item");
        }

        // Create return request
        const request = await this.prismaService.returnRequest.create({
            data: {
                orderItemId: dto.orderItemId,
                userId,
                reason: dto.reason,
                images: dto.images,
                status: ReturnStatus.PENDING,
            },
            include: {
                orderItem: true,
            },
        });

        // Notify seller
        try {
            await this.notificationService.create(
                orderItem.order.sellerId,
                "New Return Request Received",
                `A return request has been submitted for order item #${orderItem.id}.`,
                NotificationType.ORDER,
            );
        } catch (e) {
            console.error("Failed to send notification to seller", e);
        }

        return request;
    }

    async findMyReturns(userId: number, query: ReturnQueryDto) {
        const { page = 1, limit = 10, status } = query;
        const skip = (page - 1) * limit;

        const whereClause: any = { userId };
        if (status) {
            whereClause.status = status;
        }

        const [data, total] = await Promise.all([
            this.prismaService.returnRequest.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: {
                    orderItem: {
                        include: {
                            order: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
            }),
            this.prismaService.returnRequest.count({ where: whereClause }),
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

    async findReturnById(returnId: number, userId: number, role: string) {
        const request = await this.prismaService.returnRequest.findUnique({
            where: { id: returnId },
            include: {
                orderItem: {
                    include: {
                        order: true,
                    },
                },
            },
        });

        if (!request) {
            throw new NotFoundException(`Return request with ID ${returnId} not found`);
        }

        // Permissions check
        if (role !== "ADMIN") {
            if (role === "SELLER") {
                if (request.orderItem.order.sellerId !== userId) {
                    throw new ForbiddenException("You do not have permission to view this return request");
                }
            } else {
                if (request.userId !== userId) {
                    throw new ForbiddenException("You do not have permission to view this return request");
                }
            }
        }

        return request;
    }

    async findSellerReturns(sellerId: number, query: ReturnQueryDto) {
        const { page = 1, limit = 10, status } = query;
        const skip = (page - 1) * limit;

        const whereClause: any = {
            orderItem: {
                order: {
                    sellerId,
                },
            },
        };
        if (status) {
            whereClause.status = status;
        }

        const [data, total] = await Promise.all([
            this.prismaService.returnRequest.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: {
                    orderItem: {
                        include: {
                            order: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
            }),
            this.prismaService.returnRequest.count({ where: whereClause }),
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

    async updateReturnStatusSeller(returnId: number, sellerId: number, status: ReturnStatus) {
        const request = await this.prismaService.returnRequest.findUnique({
            where: { id: returnId },
            include: {
                orderItem: {
                    include: {
                        order: true,
                    },
                },
            },
        });

        if (!request) {
            throw new NotFoundException(`Return request with ID ${returnId} not found`);
        }

        if (request.orderItem.order.sellerId !== sellerId) {
            throw new ForbiddenException("You do not have permission to update this return request");
        }

        if (request.status !== ReturnStatus.PENDING) {
            throw new BadRequestException(`Return request is already ${request.status}`);
        }

        if (status !== ReturnStatus.APPROVED && status !== ReturnStatus.REJECTED) {
            throw new BadRequestException("Sellers can only set status to APPROVED or REJECTED");
        }

        const updated = await this.prismaService.returnRequest.update({
            where: { id: returnId },
            data: { status },
            include: {
                orderItem: true,
            },
        });

        // Notify buyer
        try {
            await this.notificationService.create(
                request.userId,
                "Return Request Status Update",
                `Your return request for item #${request.orderItem.id} has been ${status}.`,
                NotificationType.ORDER,
            );
        } catch (e) {
            console.error("Failed to notify buyer", e);
        }

        return updated;
    }

    async findAllReturnsAdmin(query: ReturnQueryDto) {
        const { page = 1, limit = 10, status } = query;
        const skip = (page - 1) * limit;

        const whereClause: any = {};
        if (status) {
            whereClause.status = status;
        }

        const [data, total] = await Promise.all([
            this.prismaService.returnRequest.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: {
                    orderItem: {
                        include: {
                            order: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
            }),
            this.prismaService.returnRequest.count({ where: whereClause }),
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

    async updateReturnStatusAdmin(returnId: number, status: ReturnStatus) {
        const request = await this.prismaService.returnRequest.findUnique({
            where: { id: returnId },
        });

        if (!request) {
            throw new NotFoundException(`Return request with ID ${returnId} not found`);
        }

        const updated = await this.prismaService.returnRequest.update({
            where: { id: returnId },
            data: { status },
            include: {
                orderItem: true,
            },
        });

        // Notify buyer
        try {
            await this.notificationService.create(
                request.userId,
                "Return Request Status Update (Admin)",
                `Your return request for item #${request.orderItemId} has been ${status} by admin.`,
                NotificationType.ORDER,
            );
        } catch (e) {
            console.error("Failed to notify buyer", e);
        }

        return updated;
    }
}
