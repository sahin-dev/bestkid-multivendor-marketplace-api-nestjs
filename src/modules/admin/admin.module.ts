import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { CurrencyModule } from "../currency/currency.module";

@Module({
    imports: [PrismaModule, CurrencyModule],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule {}
