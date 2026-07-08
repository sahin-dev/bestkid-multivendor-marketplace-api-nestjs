import { Module } from "@nestjs/common";
import { ReturnService } from "./return.service";
import { ReturnController } from "./return.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationModule } from "../notification/notification.module";
import { ChatModule } from "../chat/chat.module";

@Module({
    imports: [PrismaModule, NotificationModule, ChatModule],
    providers: [ReturnService],
    controllers: [ReturnController],
    exports: [ReturnService],
})
export class ReturnModule {}
