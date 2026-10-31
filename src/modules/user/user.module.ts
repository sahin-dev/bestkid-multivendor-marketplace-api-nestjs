import { Module } from "@nestjs/common";
import { UserController } from "./controllers/user.controller";
import { UserService } from "../auth/providers/user.service";
import { AdminUserService } from "./providers/admin-user.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { PaymentModule } from "../payment/payment.module";

@Module({
    imports: [PrismaModule, AuthModule, PaymentModule],
    controllers: [UserController],
    providers: [AdminUserService],
    exports: [AdminUserService],
})
export class UserModule {}