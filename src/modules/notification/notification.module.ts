import { Module } from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { NotificationController } from "./notification.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { FirebasePushService } from "./firebase-push.service";
import { NotificationRetryScheduler } from "./notification.retry.scheduler";

@Module({
    imports: [PrismaModule],
    providers: [FirebasePushService, NotificationService, NotificationRetryScheduler],
    controllers: [NotificationController],
    exports: [NotificationService],
})
export class NotificationModule {}
