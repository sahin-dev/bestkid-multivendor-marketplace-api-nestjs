import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SellerController } from "./seller.controller";
import { SellerService } from "./seller.service";
import { CurrencyModule } from "../currency/currency.module";

@Module({
    imports: [PrismaModule, CurrencyModule],
    controllers: [SellerController],
    providers: [SellerService],
    exports: [SellerService],
})
export class SellerModule {}
