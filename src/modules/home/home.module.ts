import { Module } from "@nestjs/common";
import { HomeService } from "./home.service";
import { HomeController } from "./home.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { CurrencyModule } from "../currency/currency.module";
import { HomeBannerModule } from "../home-banner/home-banner.module";

@Module({
    imports: [PrismaModule, CurrencyModule, HomeBannerModule],
    providers: [HomeService],
    controllers: [HomeController],
})
export class HomeModule {}
