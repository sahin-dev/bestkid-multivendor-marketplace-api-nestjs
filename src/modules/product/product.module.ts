import { Module } from "@nestjs/common";
import { ProductController } from "./product.controller";
import { ProductService } from "./product.service";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationModule } from "../notification/notification.module";
import { CurrencyModule } from "../currency/currency.module";

@Module({
    imports: [PrismaModule, NotificationModule, CurrencyModule],
    controllers: [ProductController],
    providers: [ProductService],
    exports: [ProductService],
})
export class ProductModule {}
