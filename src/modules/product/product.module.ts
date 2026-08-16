import { Module } from "@nestjs/common";
import { ProductController } from "./product.controller";
import { ProductService } from "./product.service";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationModule } from "../notification/notification.module";
import { CurrencyConversionService } from "../currency/currency.service";

@Module({
    imports: [PrismaModule, NotificationModule],
    controllers: [ProductController],
    providers: [ProductService, CurrencyConversionService],
    exports: [ProductService],
})
export class ProductModule {}
