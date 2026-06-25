import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreateFaqDto {
    @IsNumber()
    @IsNotEmpty()
    @ApiProperty({ description: "Category ID for the FAQ" })
    categoryId: number;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "FAQ question" })
    question: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "FAQ answer" })
    answer: string;
}
