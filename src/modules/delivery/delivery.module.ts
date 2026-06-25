import { Module } from "@nestjs/common";
import { DeliveryService } from "./delivery.service";
import { DeliveryController } from "./delivery.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
    imports: [PrismaModule],
    providers: [DeliveryService],
    controllers: [DeliveryController],
    exports: [DeliveryService],
})
export class DeliveryModule {}
