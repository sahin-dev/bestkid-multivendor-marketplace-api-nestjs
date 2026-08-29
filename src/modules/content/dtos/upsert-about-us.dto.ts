import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class UpsertAboutUsDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Markdown/HTML/text content for the About Us page" })
    content: string;
}
