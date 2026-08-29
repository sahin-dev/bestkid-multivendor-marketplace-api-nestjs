import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { WishlistController } from "./wishlist.controller";
import { WishlistService } from "./wishlist.service";
import { CurrencyModule } from "../currency/currency.module";

@Module({
    imports: [PrismaModule, CurrencyModule],
    controllers: [WishlistController],
    providers: [WishlistService],
    exports: [WishlistService],
})
export class WishlistModule {}
