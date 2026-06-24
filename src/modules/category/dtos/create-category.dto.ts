import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateCategoryDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Category name" })
    name: string;

    @IsString()
    @IsOptional()
    @ApiProperty({ required: false, description: "Category description" })
    description?: string;

    @IsString()
    @IsOptional()
    @ApiProperty({ required: false, description: "Category image URL" })
    image_url?: string;
}
