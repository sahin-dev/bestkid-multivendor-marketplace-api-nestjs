import { Module } from "@nestjs/common"
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";
import { PrismaModule } from "../prisma/prisma.module";
import { EncoderProvider } from "../auth/providers/encoder.provider";

@Module({
    imports:[PrismaModule],
    controllers:[ProfileController],
    providers:[ProfileService, EncoderProvider],
    exports:[ProfileService]
})
export class ProfileModule {

}