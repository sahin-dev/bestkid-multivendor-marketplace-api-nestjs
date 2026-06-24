import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateSubCategoryDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Subcategory name" })
    name: string;

    @IsString()
    @IsOptional()
    @ApiProperty({ required: false, description: "Subcategory description" })
    description?: string;
}
