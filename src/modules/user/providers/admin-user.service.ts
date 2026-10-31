import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UserService } from "../../auth/providers/user.service";
import { PaymentService } from "../../payment/payment.service";
import { OrderStatus, SellerTier, UserRole } from "generated/prisma/client";

@Injectable()
export class AdminUserService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly userService: UserService,
        private readonly paymentService: PaymentService,
    ) {}

    async findAllUsers(page = 1, limit = 10, search?: string, role?: UserRole, isBlocked?: boolean) {
        const skip = (page - 1) * limit;

        const whereClause: any = {};
        if (search) {
            whereClause.OR = [
                { email: { contains: search, mode: "insensitive" } },
                {
                    profile: {
                        full_name: { contains: search, mode: "insensitive" },
                    },
                },
            ];
        }
        if (role) {
            whereClause.role = role;
        }
        if (isBlocked !== undefined) {
            whereClause.is_blocked = isBlocked;
        }

        const [data, total] = await Promise.all([
            this.prismaService.baseUser.findMany({
                where: whereClause,
                skip,
                take: limit,
                omit: { password: true },
                include: { profile: true },
                orderBy: { createdAt: "desc" },
            }),
            this.prismaService.baseUser.count({ where: whereClause }),
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

    async blockUser(id: number) {
        const user = await this.prismaService.baseUser.findUnique({ where: { id } });
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }
        if (user.role === "ADMIN") {
            throw new BadRequestException("Admin users cannot be blocked");
        }

        return this.prismaService.baseUser.update({
            where: { id },
            data: { is_blocked: true },
            omit: { password: true },
            include: { profile: true },
        });
    }

    async unblockUser(id: number) {
        const user = await this.prismaService.baseUser.findUnique({ where: { id } });
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        return this.prismaService.baseUser.update({
            where: { id },
            data: { is_blocked: false },
            omit: { password: true },
            include: { profile: true },
        });
    }

    async toggleBlockUser(id: number) {
        const user = await this.prismaService.baseUser.findUnique({ where: { id } });
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }
        if (user.role === "ADMIN") {
            throw new BadRequestException("Admin users cannot be blocked");
        }

        return this.prismaService.baseUser.update({
            where: { id },
            data: { is_blocked: !user.is_blocked },
            omit: { password: true },
            include: { profile: true },
        });
    }

    async updateUserRole(id: number, role: UserRole) {
        const user = await this.prismaService.baseUser.findUnique({ where: { id } });
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        return this.prismaService.baseUser.update({
            where: { id },
            data: { role },
            omit: { password: true },
            include: { profile: true },
        });
    }

    async findUserDetail(id: number) {
        const [user, buyingStats, sellingStats, listedProducts] = await Promise.all([
            this.prismaService.baseUser.findUnique({
                where: { id },
                include: {
                    profile: true,
                },
                omit: { password: true },
            }),
            this.getBuyingStats(id),
            this.getSellingStats(id),
            this.prismaService.product.count({ where: { userId: id } }),
        ]);

        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        return {
            ...user,
            statistics: {
                buying: buyingStats,
                selling: {
                    ...sellingStats,
                    listedProducts,
                },
            },
        };
    }

    async findUserProducts(id: number, page = 1, limit = 10) {
        const user = await this.prismaService.baseUser.findUnique({ where: { id }, select: { id: true } });
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prismaService.product.findMany({
                where: { userId: id },
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    category: true,
                    subCategory: true,
                },
            }),
            this.prismaService.product.count({ where: { userId: id } }),
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

    async updateSellerTier(id: number, sellerTier: SellerTier) {
        const user = await this.prismaService.baseUser.findUnique({ where: { id } });
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }
        if (user.role === "ADMIN") {
            throw new BadRequestException("Admin users cannot be assigned a seller tier");
        }

        return this.prismaService.baseUser.update({
            where: { id },
            data: { seller_tier: sellerTier },
            omit: { password: true },
            include: { profile: true },
        });
    }

    async deleteUser(id: number) {
        const user = await this.prismaService.baseUser.findUnique({
            where: { id },
            include: { profile: true },
        });
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }
        if (user.role === "ADMIN") {
            throw new BadRequestException("Admin users cannot be deleted");
        }

        const activeOrders = await this.prismaService.order.count({
            where: {
                OR: [{ userId: id }, { sellerId: id }],
                status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.SHIPPED] },
            },
        });
        if (activeOrders > 0) {
            throw new BadRequestException("This user has orders in progress and cannot be deleted yet.");
        }

        await this.userService.anonymizeUser(id);

        return { message: "User deleted successfully" };
    }

    private async getBuyingStats(userId: number) {
        const [totalOrders, activeOrders, totalReturns, totalCanceled] = await Promise.all([
            this.prismaService.order.count({ where: { userId } }),
            this.prismaService.order.count({
                where: {
                    userId,
                    status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.SHIPPED] },
                },
            }),
            this.prismaService.returnRequest.count({ where: { userId } }),
            this.prismaService.order.count({ where: { userId, status: OrderStatus.CANCELLED } }),
        ]);

        return {
            totalOrders,
            activeOrders,
            totalReturns,
            totalCanceled,
        };
    }

    private async getSellingStats(sellerId: number) {
        const seller = await this.prismaService.baseUser.findUnique({
            where: { id: sellerId },
            select: { seller_tier: true },
        });

        const [totalOrders, earnings, totalReturns, totalCanceled] = await Promise.all([
            this.prismaService.order.count({ where: { sellerId, status: { not: OrderStatus.PENDING } } }),
            this.paymentService.getSellerEarnings(
                { sellerId, status: { notIn: [OrderStatus.PENDING, OrderStatus.CANCELLED, OrderStatus.REFUNDED] } },
                seller?.seller_tier ?? SellerTier.BASIC_SELLER,
            ),
            this.prismaService.returnRequest.count({
                where: {
                    orderItem: {
                        order: { sellerId },
                    },
                },
            }),
            this.prismaService.order.count({ where: { sellerId, status: OrderStatus.CANCELLED } }),
        ]);

        return {
            totalOrders,
            totalEarnings: earnings.net,
            totalReturns,
            totalCanceled,
        };
    }
}
