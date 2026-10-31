import { forwardRef, Module } from "@nestjs/common";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";
import { PrismaModule } from "../prisma/prisma.module";
import { DeliveryModule } from "../delivery/delivery.module";
import { NotificationModule } from "../notification/notification.module";
import { ChatModule } from "../chat/chat.module";
import { CurrencyModule } from "../currency/currency.module";
import { PaymentModule } from "../payment/payment.module";
import { StripeModule } from "../stripe/stripe.module";
import { SMTPProvider } from "src/common/providres/smtp.provider";

@Module({
    imports: [PrismaModule, DeliveryModule, NotificationModule, ChatModule, CurrencyModule, PaymentModule, forwardRef(() => StripeModule)],
    controllers: [OrderController],
    providers: [OrderService, SMTPProvider],
    exports: [OrderService],
})
export class OrderModule {}
