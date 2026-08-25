import { Module } from "@nestjs/common";
import { CartService } from "./cart.service";
import { CartController } from "./cart.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { DeliveryModule } from "../delivery/delivery.module";
import { CurrencyModule } from "../currency/currency.module";

@Module({
    imports: [PrismaModule, DeliveryModule, CurrencyModule],
    providers: [CartService],
    controllers: [CartController],
    exports: [CartService],
})
export class CartModule {}
