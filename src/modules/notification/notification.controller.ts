import { Controller, Delete, Get, Param, ParseIntPipe, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { GetUser } from "src/common/decorators";
import { NotificationService } from "./notification.service";
import { NotificationQueryDto } from "./dtos/notification-query.dto";

@ApiTags("Notifications")
@Controller("notifications")
@ApiBearerAuth("access-token")
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) {}

    @Get()
    async findAll(@GetUser("id") userId: number, @Query() query: NotificationQueryDto) {
        return this.notificationService.findAll(userId, query);
    }

    @Get("unread-count")
    async getUnreadCount(@GetUser("id") userId: number) {
        return this.notificationService.getUnreadCount(userId);
    }

    @Patch("read-all")
    async markAllRead(@GetUser("id") userId: number) {
        return this.notificationService.markAllRead(userId);
    }

    @Patch(":id/read")
    async markRead(@Param("id", ParseIntPipe) id: number, @GetUser("id") userId: number) {
        return this.notificationService.markRead(id, userId);
    }

    @Delete(":id")
    async delete(@Param("id", ParseIntPipe) id: number, @GetUser("id") userId: number) {
        return this.notificationService.delete(id, userId);
    }
}
