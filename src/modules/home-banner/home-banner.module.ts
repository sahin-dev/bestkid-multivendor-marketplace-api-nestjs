import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { HomeBannerController } from "./home-banner.controller";
import { HomeBannerService } from "./home-banner.service";

@Module({
    imports: [PrismaModule],
    controllers: [HomeBannerController],
    providers: [HomeBannerService],
    exports: [HomeBannerService],
})
export class HomeBannerModule {}
