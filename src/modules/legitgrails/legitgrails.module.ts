import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import legitgrailsConfig from "src/config/legitgrails.config";
import { PrismaModule } from "../prisma/prisma.module";
import { LegitGrailsClient } from "./legitgrails.client";
import { LegitGrailsController } from "./legitgrails.controller";
import { LegitGrailsService } from "./legitgrails.service";

@Module({
    imports: [PrismaModule, ConfigModule.forFeature(legitgrailsConfig)],
    controllers: [LegitGrailsController],
    providers: [LegitGrailsClient, LegitGrailsService],
    exports: [LegitGrailsService],
})
export class LegitGrailsModule {}
