import { Module } from "@nestjs/common"
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";
import { PrismaModule } from "../prisma/prisma.module";
import { EncoderProvider } from "../auth/providers/encoder.provider";
import { FileUploadModule } from "../file-upload/file-upload.module";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports:[PrismaModule, FileUploadModule, AuthModule],
    controllers:[ProfileController],
    providers:[ProfileService, EncoderProvider],
    exports:[ProfileService]
})
export class ProfileModule {

}
