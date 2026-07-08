import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class CreateReviewDto {
    @IsInt()
    @Min(1)
    @Max(5)
    @ApiProperty({ description: "Rating from 1 to 5 stars" })
    rating: number;

    @IsString()
    @IsOptional()
    @MaxLength(1000)
    @ApiProperty({ required: false, description: "Optional review text" })
    review?: string;
}
