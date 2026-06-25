import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class UpsertLegalDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Markdown/HTML content of the legal document" })
    content: string;
}
