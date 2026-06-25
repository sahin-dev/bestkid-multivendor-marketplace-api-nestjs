import { Module } from "@nestjs/common";
import { ReturnService } from "./return.service";
import { ReturnController } from "./return.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationModule } from "../notification/notification.module";

@Module({
    imports: [PrismaModule, NotificationModule],
    providers: [ReturnService],
    controllers: [ReturnController],
    exports: [ReturnService],
})
export class ReturnModule {}
