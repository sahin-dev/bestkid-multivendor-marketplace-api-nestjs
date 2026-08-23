import { Module } from "@nestjs/common";
import { ReturnService } from "./return.service";
import { ReturnController } from "./return.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationModule } from "../notification/notification.module";
import { ChatModule } from "../chat/chat.module";
import { StripeModule } from "../stripe/stripe.module";

@Module({
    imports: [PrismaModule, NotificationModule, ChatModule, StripeModule],
    providers: [ReturnService],
    controllers: [ReturnController],
    exports: [ReturnService],
})
export class ReturnModule {}
