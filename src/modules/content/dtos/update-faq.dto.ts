import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString } from "class-validator";

export class UpdateFaqDto {
    @IsNumber()
    @IsOptional()
    @ApiPropertyOptional({ description: "Category ID for the FAQ" })
    categoryId?: number;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ description: "FAQ question" })
    question?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ description: "FAQ answer" })
    answer?: string;
}
