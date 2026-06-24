import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AdminUserService {
    constructor(private readonly prismaService: PrismaService) {}

    async findAllUsers(page = 1, limit = 10, search?: string) {
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

        return this.prismaService.$transaction(async (tx) => {
            // Delete reviews
            await tx.productReview.deleteMany({ where: { userId: id } });

            // Delete orders and order items
            const orders = await tx.order.findMany({ where: { userId: id } });
            const orderIds = orders.map((o) => o.id);
            if (orderIds.length > 0) {
                await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
                await tx.order.deleteMany({ where: { userId: id } });
            }

            // Delete OTP verification
            await tx.otpVerification.deleteMany({ where: { userId: id } });

            // Delete user record
            const deletedUser = await tx.baseUser.delete({
                where: { id },
                include: { profile: true },
            });

            // Delete profile if it exists
            if (user.profile_id) {
                await tx.profile.delete({ where: { id: user.profile_id } });
            }

            return deletedUser;
        });
    }
}
