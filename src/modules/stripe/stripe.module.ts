import { forwardRef, Module } from "@nestjs/common";
import { StripeService } from "./stripe.service";
import { StripeController } from "./stripe.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { ConfigModule } from "@nestjs/config";
import stripeConfig from "src/config/stripe.config";
import { OrderModule } from "../order/order.module";
import { PaymentModule } from "../payment/payment.module";
import { CurrencyModule } from "../currency/currency.module";
import { NotificationModule } from "../notification/notification.module";

@Module({
    imports: [PrismaModule, ConfigModule.forFeature(stripeConfig), forwardRef(() => OrderModule), PaymentModule, CurrencyModule, NotificationModule],
    providers: [StripeService],
    controllers: [StripeController],
    exports: [StripeService],
})
export class StripeModule {}
