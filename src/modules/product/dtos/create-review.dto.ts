import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class CreateReviewDto {
    @IsInt()
    @Min(1)
    @Max(5)
    @ApiProperty({ example: 5, minimum: 1, maximum: 5, description: "Rating from 1 to 5 stars" })
    rating: number;

    @IsString()
    @IsOptional()
    @MaxLength(1000)
    @ApiProperty({ required: false, example: "Very comfortable and lightweight.", description: "Optional review text" })
    review?: string;
}
