import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationQueryDto } from "./dtos/notification-query.dto";
import { NotificationType } from "generated/prisma/client";

@Injectable()
export class NotificationService {
    constructor(private readonly prismaService: PrismaService) {}

    async create(userId: number, title: string, message: string, type: NotificationType) {
        return this.prismaService.notification.create({
            data: {
                userId,
                title,
                message,
                type,
            },
        });
    }

    async findAll(userId: number, query: NotificationQueryDto) {
        const { page = 1, limit = 10 } = query;
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.prismaService.notification.findMany({
                where: { userId },
                skip,
                take: limit,
                orderBy: [
                    { isRead: "asc" }, // Unread first
                    { createdAt: "desc" },
                ],
            }),
            this.prismaService.notification.count({ where: { userId } }),
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

    async getUnreadCount(userId: number) {
        const count = await this.prismaService.notification.count({
            where: { userId, isRead: false },
        });
        return { count };
    }

    async markRead(notificationId: number, userId: number) {
        const notification = await this.prismaService.notification.findUnique({
            where: { id: notificationId },
        });

        if (!notification) {
            throw new NotFoundException(`Notification with ID ${notificationId} not found`);
        }

        if (notification.userId !== userId) {
            throw new ForbiddenException("You cannot access this notification");
        }

        return this.prismaService.notification.update({
            where: { id: notificationId },
            data: { isRead: true },
        });
    }

    async markAllRead(userId: number) {
        await this.prismaService.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });

        return { message: "All notifications marked as read" };
    }

    async delete(notificationId: number, userId: number) {
        const notification = await this.prismaService.notification.findUnique({
            where: { id: notificationId },
        });

        if (!notification) {
            throw new NotFoundException(`Notification with ID ${notificationId} not found`);
        }

        if (notification.userId !== userId) {
            throw new ForbiddenException("You cannot delete this notification");
        }

        await this.prismaService.notification.delete({
            where: { id: notificationId },
        });

        return { message: "Notification deleted" };
    }
}
