import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReturnDto } from "./dtos/create-return.dto";
import { ReturnQueryDto, ReturnTab, SellerReturnTab } from "./dtos/return-query.dto";
import { OrderStatus, ReturnStatus, NotificationType } from "generated/prisma/client";
import { NotificationService } from "../notification/notification.service";
import { UpdateReturnStatusDto } from "./dtos/update-return-status.dto";
import { ChatService } from "../chat/chat.service";
import { assertEntityExists } from "src/common/validators/entity-exists.validator";

@Injectable()
export class ReturnService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly notificationService: NotificationService,
        private readonly chatService: ChatService,
    ) {}

    async createReturn(userId: number, dto: CreateReturnDto) {
        await assertEntityExists(this.prismaService.baseUser, "User", userId);

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

        if (orderItem.order.status !== OrderStatus.DELIVERED) {
            throw new BadRequestException("You can request a return only after the order is delivered");
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
                message: dto.message,
                images: dto.images ?? [],
                status: ReturnStatus.PENDING,
            },
            include: this.getReturnDetailInclude(),
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

        return this.formatReturnDetail(request);
    }

    async findMyReturns(userId: number, query: ReturnQueryDto) {
        const { page = 1, limit = 10, status, tab } = query;
        const skip = (page - 1) * limit;

        const whereClause: any = { userId };
        if (status) {
            whereClause.status = status;
        } else if (tab) {
            whereClause.status = { in: this.getStatusesForTab(tab) };
        }

        const [data, total] = await Promise.all([
            this.prismaService.returnRequest.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: this.getReturnListInclude(),
                orderBy: {
                    createdAt: "desc",
                },
            }),
            this.prismaService.returnRequest.count({ where: whereClause }),
        ]);

        return {
            data: data.map((request) => this.formatReturnCard(request)),
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
            include: this.getReturnDetailInclude(),
        });

        if (!request) {
            throw new NotFoundException(`Return request with ID ${returnId} not found`);
        }

        if (role !== "ADMIN") {
            const isBuyer = request.userId === userId;
            const isSeller = request.orderItem.order.sellerId === userId;

            if (!isBuyer && !isSeller) {
                throw new ForbiddenException("You do not have permission to view this return request");
            }
        }

        return this.formatReturnDetail(request, userId);
    }

    async findSellerReturns(sellerId: number, query: ReturnQueryDto) {
        const { page = 1, limit = 10, status, sellerTab } = query;
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
        } else if (sellerTab) {
            whereClause.status = { in: this.getStatusesForSellerTab(sellerTab) };
        }

        const [data, total] = await Promise.all([
            this.prismaService.returnRequest.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: this.getReturnListInclude(),
                orderBy: {
                    createdAt: "desc",
                },
            }),
            this.prismaService.returnRequest.count({ where: whereClause }),
        ]);

        return {
            data: data.map((request) => this.formatSellerReturnCard(request)),
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async updateReturnStatusSeller(returnId: number, sellerId: number, dto: UpdateReturnStatusDto) {
        const request = await this.prismaService.returnRequest.findUnique({
            where: { id: returnId },
            include: this.getReturnDetailInclude(),
        });

        if (!request) {
            throw new NotFoundException(`Return request with ID ${returnId} not found`);
        }

        if (request.orderItem.order.sellerId !== sellerId) {
            throw new ForbiddenException("You do not have permission to update this return request");
        }

        this.validateReturnStatusTransition(request.status, dto.status);
        this.validateSellerReturnUpdate(dto);

        const updated = await this.prismaService.returnRequest.update({
            where: { id: returnId },
            data: this.getReturnUpdateData(dto),
            include: this.getReturnDetailInclude(),
        });

        // Notify buyer
        try {
            await this.notificationService.create(
                request.userId,
                "Return Request Status Update",
                `Your return request for item #${request.orderItem.id} has been ${dto.status}.`,
                NotificationType.ORDER,
            );
        } catch (e) {
            console.error("Failed to notify buyer", e);
        }

        return this.formatReturnDetail(updated, sellerId);
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
                include: this.getReturnListInclude(),
                orderBy: {
                    createdAt: "desc",
                },
            }),
            this.prismaService.returnRequest.count({ where: whereClause }),
        ]);

        return {
            data: data.map((request) => this.formatReturnCard(request)),
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async updateReturnStatusAdmin(returnId: number, dto: UpdateReturnStatusDto) {
        const request = await this.prismaService.returnRequest.findUnique({
            where: { id: returnId },
        });

        if (!request) {
            throw new NotFoundException(`Return request with ID ${returnId} not found`);
        }

        const updated = await this.prismaService.returnRequest.update({
            where: { id: returnId },
            data: this.getReturnUpdateData(dto),
            include: this.getReturnDetailInclude(),
        });

        // Notify buyer
        try {
            await this.notificationService.create(
                request.userId,
                "Return Request Status Update (Admin)",
                `Your return request for item #${request.orderItemId} has been ${dto.status} by admin.`,
                NotificationType.ORDER,
            );
        } catch (e) {
            console.error("Failed to notify buyer", e);
        }

        return this.formatReturnDetail(updated);
    }

    async findOrCreateReturnChat(returnId: number, userId: number) {
        const request = await this.prismaService.returnRequest.findUnique({
            where: { id: returnId },
            include: { orderItem: { include: { order: true } } },
        });

        if (!request) {
            throw new NotFoundException(`Return request with ID ${returnId} not found`);
        }

        const order = request.orderItem.order;
        if (order.userId !== userId && order.sellerId !== userId) {
            throw new ForbiddenException("You do not have permission to access this return conversation");
        }

        return this.chatService.findOrCreateRoom(order.userId, order.sellerId);
    }

    private getStatusesForTab(tab: ReturnTab) {
        const tabMap: Record<ReturnTab, ReturnStatus[]> = {
            [ReturnTab.RETURN_REQUESTS]: [ReturnStatus.PENDING],
            [ReturnTab.ACCEPTED]: [ReturnStatus.APPROVED, ReturnStatus.PROCESSING, ReturnStatus.COMPLETED],
            [ReturnTab.REJECTED]: [ReturnStatus.REJECTED],
        };
        return tabMap[tab];
    }

    private getStatusesForSellerTab(tab: SellerReturnTab) {
        const tabMap: Record<SellerReturnTab, ReturnStatus[]> = {
            [SellerReturnTab.IN_REVIEW]: [ReturnStatus.PENDING],
            [SellerReturnTab.PROCESSING]: [ReturnStatus.APPROVED, ReturnStatus.PROCESSING],
            [SellerReturnTab.COMPLETED]: [ReturnStatus.COMPLETED],
            [SellerReturnTab.REJECTED]: [ReturnStatus.REJECTED],
        };
        return tabMap[tab];
    }

    private getReturnListInclude() {
        return {
            orderItem: {
                include: {
                    product: { select: { id: true, name: true, image_urls: true } },
                    variant: true,
                    order: {
                        include: {
                            seller: {
                                select: {
                                    id: true,
                                    email: true,
                                    profile: { select: { full_name: true, avatar_url: true, country: true } },
                                },
                            },
                            user: {
                                select: {
                                    id: true,
                                    email: true,
                                    profile: { select: { full_name: true, avatar_url: true, country: true, phone: true } },
                                },
                            },
                        },
                    },
                },
            },
        };
    }

    private getReturnDetailInclude() {
        return {
            orderItem: {
                include: {
                    product: { select: { id: true, name: true, image_urls: true } },
                    variant: true,
                    order: {
                        include: {
                            seller: {
                                select: {
                                    id: true,
                                    email: true,
                                    profile: { select: { full_name: true, avatar_url: true, country: true, phone: true } },
                                },
                            },
                            user: {
                                select: {
                                    id: true,
                                    email: true,
                                    profile: { select: { full_name: true, avatar_url: true, country: true, phone: true } },
                                },
                            },
                            items: {
                                include: {
                                    product: { select: { id: true, name: true, image_urls: true } },
                                    variant: true,
                                },
                            },
                        },
                    },
                },
            },
        };
    }

    private formatReturnCard(request: any) {
        const order = request.orderItem.order;
        return {
            id: request.id,
            order_id: order.id,
            display_order_id: this.getDisplayOrderId(order.id),
            status: request.status,
            status_label: this.getStatusLabel(request.status),
            status_tone: this.getStatusTone(request.status),
            submitted_on: request.createdAt,
            seller: order.seller,
            preview_item: {
                id: request.orderItem.id,
                productId: request.orderItem.productId,
                name: request.orderItem.product?.name,
                image_url: request.orderItem.product?.image_urls?.[0] ?? null,
                variant: request.orderItem.variant,
                quantity: request.orderItem.quantity,
                price: request.orderItem.price,
            },
        };
    }

    private formatSellerReturnCard(request: any) {
        return {
            ...this.formatReturnCard(request),
            buyer: request.user ?? request.orderItem.order.user ?? null,
            actions: {
                can_view_details: true,
                can_update_status: ![ReturnStatus.COMPLETED, ReturnStatus.REJECTED].includes(request.status),
            },
        };
    }

    private async formatReturnDetail(request: any, viewerId?: number) {
        const order = request.orderItem.order;
        const chatRoomId = viewerId ? await this.getExistingChatRoomId(order.userId, order.sellerId) : null;

        return {
            id: request.id,
            status: request.status,
            status_label: this.getStatusLabel(request.status),
            status_tone: this.getStatusTone(request.status),
            submitted_on: request.createdAt,
            resolved_at: request.resolved_at,
            reason: request.reason,
            message: request.message,
            images: request.images,
            seller_response: request.seller_response,
            seller_rejection_reason: request.seller_rejection_reason,
            return_address: request.return_address,
            completed_at: request.completed_at,
            refunded_at: request.refunded_at,
            refund_amount: request.refund_amount,
            chat_room_id: chatRoomId,
            order: {
                id: order.id,
                display_id: this.getDisplayOrderId(order.id),
                status: order.status,
                total: order.total,
                createdAt: order.createdAt,
                delivered_at: order.delivered_at,
                seller: order.seller,
                buyer: order.user,
                delivery_address: {
                    address: order.shippingAddress,
                    city: order.city,
                    postal_code: order.postalCode,
                    country: order.country,
                },
                items: order.items.map((item: any) => ({
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
                          }
                        : null,
                    variant: item.variant,
                    is_returned_item: item.id === request.orderItemId,
                })),
            },
            returned_item: {
                id: request.orderItem.id,
                productId: request.orderItem.productId,
                variantId: request.orderItem.variantId,
                quantity: request.orderItem.quantity,
                price: request.orderItem.price,
                product: request.orderItem.product,
                variant: request.orderItem.variant,
            },
            actions: {
                can_message_seller: true,
                can_update_status: ![ReturnStatus.COMPLETED, ReturnStatus.REJECTED].includes(request.status),
                can_send_return_instructions: [ReturnStatus.PENDING, ReturnStatus.APPROVED].includes(request.status),
                can_complete_refund: [ReturnStatus.APPROVED, ReturnStatus.PROCESSING].includes(request.status),
                can_reject: ![ReturnStatus.COMPLETED, ReturnStatus.REJECTED].includes(request.status),
            },
        };
    }

    private validateReturnStatusTransition(currentStatus: ReturnStatus, nextStatus: ReturnStatus) {
        const validTransitions: Record<ReturnStatus, ReturnStatus[]> = {
            [ReturnStatus.PENDING]: [ReturnStatus.APPROVED, ReturnStatus.PROCESSING, ReturnStatus.REJECTED],
            [ReturnStatus.APPROVED]: [ReturnStatus.PROCESSING, ReturnStatus.COMPLETED, ReturnStatus.REJECTED],
            [ReturnStatus.PROCESSING]: [ReturnStatus.COMPLETED, ReturnStatus.REJECTED],
            [ReturnStatus.COMPLETED]: [],
            [ReturnStatus.REJECTED]: [],
        };

        const allowed = validTransitions[currentStatus] ?? [];
        if (!allowed.includes(nextStatus)) {
            throw new BadRequestException(`Invalid return status transition from ${currentStatus} to ${nextStatus}`);
        }
    }

    private validateSellerReturnUpdate(dto: UpdateReturnStatusDto) {
        const allowed: ReturnStatus[] = [
            ReturnStatus.APPROVED,
            ReturnStatus.PROCESSING,
            ReturnStatus.COMPLETED,
            ReturnStatus.REJECTED,
        ];
        if (!allowed.includes(dto.status)) {
            throw new BadRequestException("Unsupported return status update");
        }
        if (dto.status === ReturnStatus.REJECTED && !dto.seller_rejection_reason?.trim()) {
            throw new BadRequestException("seller_rejection_reason is required when rejecting a return");
        }
        if (
            (dto.status === ReturnStatus.APPROVED || dto.status === ReturnStatus.PROCESSING) &&
            !dto.return_address?.trim()
        ) {
            throw new BadRequestException("return_address is required when accepting or processing a return");
        }
        if (dto.status === ReturnStatus.COMPLETED && dto.refund_amount !== undefined && dto.refund_amount <= 0) {
            throw new BadRequestException("refund_amount must be greater than zero");
        }
    }

    private getReturnUpdateData(dto: UpdateReturnStatusDto) {
        return {
            status: dto.status,
            seller_response: dto.seller_response,
            seller_rejection_reason: dto.seller_rejection_reason,
            return_address: dto.return_address,
            refund_amount: dto.refund_amount,
            completed_at: dto.status === ReturnStatus.COMPLETED ? new Date() : undefined,
            refunded_at: dto.status === ReturnStatus.COMPLETED ? new Date() : undefined,
            resolved_at:
                dto.status === ReturnStatus.REJECTED || dto.status === ReturnStatus.COMPLETED
                    ? new Date()
                    : undefined,
        };
    }

    private getDisplayOrderId(orderId: number) {
        return `KDF${String(orderId).padStart(10, "0")}`;
    }

    private async getExistingChatRoomId(buyerId: number, sellerId: number) {
        const room = await this.prismaService.chatRoom.findUnique({
            where: { buyerId_sellerId: { buyerId, sellerId } },
            select: { id: true },
        });
        return room?.id ?? null;
    }

    private getStatusLabel(status: ReturnStatus) {
        const labels: Record<ReturnStatus, string> = {
            [ReturnStatus.PENDING]: "In Review",
            [ReturnStatus.APPROVED]: "Accepted",
            [ReturnStatus.PROCESSING]: "Processing",
            [ReturnStatus.COMPLETED]: "Completed",
            [ReturnStatus.REJECTED]: "Rejected",
        };
        return labels[status];
    }

    private getStatusTone(status: ReturnStatus) {
        const tones: Record<ReturnStatus, string> = {
            [ReturnStatus.PENDING]: "warning",
            [ReturnStatus.APPROVED]: "success",
            [ReturnStatus.PROCESSING]: "info",
            [ReturnStatus.COMPLETED]: "success",
            [ReturnStatus.REJECTED]: "danger",
        };
        return tones[status];
    }
}
