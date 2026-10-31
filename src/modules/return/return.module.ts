import { Module } from "@nestjs/common";
import { ReturnService } from "./return.service";
import { ReturnController } from "./return.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationModule } from "../notification/notification.module";
import { ChatModule } from "../chat/chat.module";
import { StripeModule } from "../stripe/stripe.module";
import { TbiCreditModule } from "../tbi-credit/tbi-credit.module";
import { PaymentModule } from "../payment/payment.module";

@Module({
    imports: [PrismaModule, NotificationModule, ChatModule, StripeModule, TbiCreditModule, PaymentModule],
    providers: [ReturnService],
    controllers: [ReturnController],
    exports: [ReturnService],
})
export class ReturnModule {}
