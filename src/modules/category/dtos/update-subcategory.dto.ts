import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class UpdateSubCategoryDto {
    @IsString()
    @IsOptional()
    @ApiProperty({ required: false, description: "Subcategory name" })
    name?: string;

    @IsString()
    @IsOptional()
    @ApiProperty({ required: false, description: "Subcategory description" })
    description?: string;
}
