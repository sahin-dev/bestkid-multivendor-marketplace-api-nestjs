import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateFaqCategoryDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "FAQ Category name" })
    name: string;
}
