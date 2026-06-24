import { Module } from "@nestjs/common";
import { UserController } from "./controllers/user.controller";
import { UserService } from "../auth/providers/user.service";
import { AdminUserService } from "./providers/admin-user.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports: [PrismaModule, AuthModule],
    controllers: [UserController],
    providers: [AdminUserService],
    exports: [AdminUserService],
})
export class UserModule {}