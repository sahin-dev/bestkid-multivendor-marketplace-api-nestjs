import { Module } from "@nestjs/common";
import { StripeService } from "./stripe.service";
import { StripeController } from "./stripe.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { ConfigModule } from "@nestjs/config";
import stripeConfig from "src/config/stripe.config";

@Module({
    imports: [PrismaModule, ConfigModule.forFeature(stripeConfig)],
    providers: [StripeService],
    controllers: [StripeController],
    exports: [StripeService],
})
export class StripeModule {}
