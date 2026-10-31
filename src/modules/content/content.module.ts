import { Module } from "@nestjs/common";
import { ContentService } from "./content.service";
import { ContentController } from "./content.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { SMTPProvider } from "src/common/providres/smtp.provider";

@Module({
    imports: [PrismaModule],
    providers: [ContentService, SMTPProvider],
    controllers: [ContentController],
    exports: [ContentService],
})
export class ContentModule {}
