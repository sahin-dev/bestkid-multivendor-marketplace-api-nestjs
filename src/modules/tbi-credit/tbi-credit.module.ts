import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import tbiCreditConfig from "src/config/tbi-credit.config";
import { CurrencyModule } from "../currency/currency.module";
import { OrderModule } from "../order/order.module";
import { PaymentModule } from "../payment/payment.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TbiCreditClient } from "./tbi-credit.client";
import { TbiCreditController } from "./tbi-credit.controller";
import { TbiCreditService } from "./tbi-credit.service";

@Module({
    imports: [PrismaModule, OrderModule, PaymentModule, CurrencyModule, ConfigModule.forFeature(tbiCreditConfig)],
    controllers: [TbiCreditController],
    providers: [TbiCreditService, TbiCreditClient],
    exports: [TbiCreditService],
})
export class TbiCreditModule {}
