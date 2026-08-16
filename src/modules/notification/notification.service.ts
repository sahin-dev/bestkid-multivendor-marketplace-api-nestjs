import { Injectable, NotFoundException, ForbiddenException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationQueryDto } from "./dtos/notification-query.dto";
import { NotificationType, PushDeliveryStatus } from "generated/prisma/client";
import { assertEntityExists } from "src/common/validators/entity-exists.validator";
import { FirebasePushService } from "./firebase-push.service";
import { RegisterDeviceTokenDto } from "./dtos/register-device-token.dto";

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly firebasePushService: FirebasePushService,
    ) {}

    async create(userId: number, title: string, message: string, type: NotificationType) {
        await assertEntityExists(this.prismaService.baseUser, "User", userId);

        const notification = await this.prismaService.notification.create({
            data: {
                userId,
                title,
                message,
                type,
            },
        });

        await this.queuePushDelivery(notification.userId, notification.id, notification.title, notification.message, notification.type);

        return notification;
    }

    async registerDeviceToken(userId: number, dto: RegisterDeviceTokenDto) {
        await assertEntityExists(this.prismaService.baseUser, "User", userId);

        const token = dto.token.trim();
        if (!token) {
            throw new NotFoundException("Device token is required");
        }

        const user = await this.prismaService.baseUser.update({
            where: { id: userId },
            data: { fcmToken: token },
        });

        return {
            id: user.id,
            userId: user.id,
            token,
            platform: dto.platform ?? "ANDROID",
            updatedAt: new Date(),
        };
    }

    async updateFcmToken(userId: number, token: string) {
        await assertEntityExists(this.prismaService.baseUser, "User", userId);

        const normalizedToken = token?.trim();
        if (!normalizedToken) {
            throw new NotFoundException("FCM token is required");
        }

        const user = await this.prismaService.baseUser.update({
            where: { id: userId },
            data: { fcmToken: normalizedToken },
        });

        return {
            id: user.id,
            userId: user.id,
            fcmToken: user.fcmToken,
            updatedAt: new Date(),
        };
    }

    async unregisterDeviceToken(userId: number, token: string) {
        await assertEntityExists(this.prismaService.baseUser, "User", userId);

        const normalized = token.trim();
        if (!normalized) {
            throw new NotFoundException("Device token is required");
        }

        await this.prismaService.userDeviceToken.updateMany({
            where: {
                userId,
                token: normalized,
            },
            data: {
                isActive: false,
            },
        });

        return { message: "Device token removed" };
    }

    async processPendingPushNotifications(limit = 20) {
        const pendingLogs = await this.prismaService.pushNotificationLog.findMany({
            where: {
                status: PushDeliveryStatus.PENDING,
                nextAttemptAt: { lte: new Date() },
            },
            take: limit,
            orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
            include: {
                deviceToken: true,
            },
        });

        for (const log of pendingLogs) {
            await this.deliverPushLog(log, log.deviceToken?.token);
        }

        return {
            processed: pendingLogs.length,
        };
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
                    { isRead: "asc" },
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

    private async queuePushDelivery(
        userId: number,
        notificationId: number,
        title: string,
        message: string,
        type: NotificationType,
    ) {
        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            select: { fcmToken: true },
        });

        const currentToken = user?.fcmToken?.trim();
        if (!currentToken) {
            return { queued: 0 };
        }

        const payload = {
            notificationId: String(notificationId),
            type,
            title,
            message,
        };

        const log = await this.prismaService.pushNotificationLog.create({
            data: {
                userId,
                notificationId,
                tokenId: null,
                title,
                message,
                type,
                payload,
                status: PushDeliveryStatus.PENDING,
                attempts: 0,
                maxAttempts: 5,
                nextAttemptAt: new Date(),
            },
        });

        await this.deliverPushLog(log, currentToken);

        return { queued: 1 };
    }

    private async deliverPushLog(log: any, token?: string) {
        if (!token) {
            await this.prismaService.pushNotificationLog.update({
                where: { id: log.id },
                data: {
                    status: PushDeliveryStatus.FAILED,
                    attempts: (log.attempts ?? 0) + 1,
                    lastError: "No valid device token available for this push delivery",
                    nextAttemptAt: null,
                },
            });
            return;
        }

        const response = await this.firebasePushService.sendToToken(token, log.title, log.message, {
            notificationId: String(log.notificationId ?? ""),
            type: String(log.type ?? ""),
        });

        const attempts = (log.attempts ?? 0) + 1;
        const retryable = !response.success && attempts < (log.maxAttempts ?? 5);

        await this.prismaService.pushNotificationLog.update({
            where: { id: log.id },
            data: {
                attempts,
                status: response.success ? PushDeliveryStatus.SENT : retryable ? PushDeliveryStatus.PENDING : PushDeliveryStatus.FAILED,
                lastError: response.error ? JSON.stringify(response.error) : null,
                sentAt: response.success ? new Date() : null,
                nextAttemptAt: retryable ? new Date(Date.now() + Math.pow(2, attempts) * 60_000) : null,
            },
        });

        if (!response.success && retryable) {
            this.logger.warn(`Push delivery retry scheduled for notification log ${log.id}. Attempts=${attempts}`);
        }
    }
}
