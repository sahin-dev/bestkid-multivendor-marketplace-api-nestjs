import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SellerController } from "./seller.controller";
import { SellerService } from "./seller.service";
import { CurrencyModule } from "../currency/currency.module";
import { PaymentModule } from "../payment/payment.module";

@Module({
    imports: [PrismaModule, CurrencyModule, PaymentModule],
    controllers: [SellerController],
    providers: [SellerService],
    exports: [SellerService],
})
export class SellerModule {}
