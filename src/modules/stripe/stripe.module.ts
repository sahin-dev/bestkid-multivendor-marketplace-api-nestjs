import { Module } from "@nestjs/common";
import { StripeService } from "./stripe.service";
import { StripeController } from "./stripe.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { ConfigModule } from "@nestjs/config";
import stripeConfig from "src/config/stripe.config";
import { OrderModule } from "../order/order.module";
import { PaymentModule } from "../payment/payment.module";
import { CurrencyModule } from "../currency/currency.module";

@Module({
    imports: [PrismaModule, ConfigModule.forFeature(stripeConfig), OrderModule, PaymentModule, CurrencyModule],
    providers: [StripeService],
    controllers: [StripeController],
    exports: [StripeService],
})
export class StripeModule {}
