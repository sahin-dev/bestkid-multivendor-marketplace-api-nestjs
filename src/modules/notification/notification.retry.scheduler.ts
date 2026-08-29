import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { NotificationService } from "./notification.service";

@Injectable()
export class NotificationRetryScheduler {
    private readonly logger = new Logger(NotificationRetryScheduler.name);

    constructor(private readonly notificationService: NotificationService) {}

    @Cron(CronExpression.EVERY_MINUTE)
    async retryPendingPushNotifications() {
        
        try {
            const result = await this.notificationService.processPendingPushNotifications(50);

            if (result.processed > 0) {
                this.logger.log(`Retried ${result.processed} pending push notification(s).`);
            } 
        } catch (error) {
            this.logger.error("Failed to process pending push notifications", error instanceof Error ? error.stack : error);
        }
    }
}
