import { Module } from "@nestjs/common";
import { CartService } from "./cart.service";
import { CartController } from "./cart.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { DeliveryModule } from "../delivery/delivery.module";

@Module({
    imports: [PrismaModule, DeliveryModule],
    providers: [CartService],
    controllers: [CartController],
    exports: [CartService],
})
export class CartModule {}
