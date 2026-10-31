import { Module } from "@nestjs/common";
import { EncoderProvider } from "../auth/providers/encoder.provider";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AccountController } from "./account.controller";
import { AccountService } from "./account.service";

@Module({
    imports: [PrismaModule, AuthModule],
    controllers: [AccountController],
    providers: [AccountService, EncoderProvider],
    exports: [AccountService],
})
export class AccountModule {}
