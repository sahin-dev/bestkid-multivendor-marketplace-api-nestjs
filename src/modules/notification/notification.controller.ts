import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { GetUser } from "src/common/decorators";
import { NotificationService } from "./notification.service";
import { NotificationQueryDto } from "./dtos/notification-query.dto";
import { RegisterDeviceTokenDto, UnregisterDeviceTokenDto } from "./dtos/register-device-token.dto";

@ApiTags("Notifications")
@Controller("notifications")
@ApiBearerAuth("access-token")
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) {}

    @Post("device-tokens")
    @ApiOperation({ summary: "Register the current device token for Firebase push delivery" })
    @ApiBody({ type: RegisterDeviceTokenDto })
    async registerDeviceToken(@GetUser("id") userId: number, @Body() dto: RegisterDeviceTokenDto) {
        return this.notificationService.registerDeviceToken(userId, dto);
    }

    @Patch("device-tokens")
    @ApiOperation({ summary: "Update the current user FCM token for push delivery" })
    @ApiBody({ type: RegisterDeviceTokenDto })
    async updateDeviceToken(@GetUser("id") userId: number, @Body() dto: RegisterDeviceTokenDto) {
        return this.notificationService.updateFcmToken(userId, dto.token);
    }

    @Delete("device-tokens")
    @ApiOperation({ summary: "Remove a registered device token" })
    async unregisterDeviceToken(@GetUser("id") userId: number, @Body() dto: UnregisterDeviceTokenDto) {
        return this.notificationService.unregisterDeviceToken(userId, dto.token);
    }

    @Post("push/retry")
    @ApiOperation({ summary: "Process pending push notifications with retry backoff" })
    async processPendingPushNotifications() {
        return this.notificationService.processPendingPushNotifications();
    }

    @Get()
    @ApiOperation({ summary: "List notifications for the authenticated user or admin" })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    async findAll(@GetUser("id") userId: number, @Query() query: NotificationQueryDto) {
        return this.notificationService.findAll(userId, query);
    }

    @Get("unread-count")
    @ApiOperation({ summary: "Get unread notification count" })
    async getUnreadCount(@GetUser("id") userId: number) {
        return this.notificationService.getUnreadCount(userId);
    }

    @Patch("read-all")
    @ApiOperation({ summary: "Mark all notifications as read" })
    async markAllRead(@GetUser("id") userId: number) {
        return this.notificationService.markAllRead(userId);
    }

    @Patch(":id/read")
    @ApiOperation({ summary: "Mark a notification as read" })
    @ApiParam({ name: "id", type: Number })
    async markRead(@Param("id", ParseIntPipe) id: number, @GetUser("id") userId: number) {
        return this.notificationService.markRead(id, userId);
    }

    @Delete(":id")
    @ApiOperation({ summary: "Delete a notification" })
    @ApiParam({ name: "id", type: Number })
    async delete(@Param("id", ParseIntPipe) id: number, @GetUser("id") userId: number) {
        return this.notificationService.delete(id, userId);
    }
}
