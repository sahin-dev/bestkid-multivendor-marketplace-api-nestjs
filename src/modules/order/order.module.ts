import { Module } from "@nestjs/common";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";
import { PrismaModule } from "../prisma/prisma.module";
import { DeliveryModule } from "../delivery/delivery.module";
import { NotificationModule } from "../notification/notification.module";

@Module({
    imports: [PrismaModule, DeliveryModule, NotificationModule],
    controllers: [OrderController],
    providers: [OrderService],
    exports: [OrderService],
})
export class OrderModule {}
