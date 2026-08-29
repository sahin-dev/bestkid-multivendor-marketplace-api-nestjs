import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, ValidateNested } from "class-validator";

const MOCK_OUTCOMES = ["authentic", "fake", "unable-to-verify", "update-photos"] as const;

export class AuthenticationPhotoDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: "overall-picture", description: "Photo index code from GET /legitgrails/photo-indexes" })
    index_code: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: "https://cdn.bestkid.test/verification/overall-picture.png", description: "Photo URL, reachable while the order is processed" })
    url: string;
}

export class SubmitProductAuthenticationDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: "bag", description: "LegitGrails category_code from GET /legitgrails/categories" })
    category_code: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: "gucci", description: "LegitGrails brand_code from GET /legitgrails/brands" })
    brand_code: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ example: "gucci-bag-gg-marmont", description: "Optional LegitGrails model_code from GET /legitgrails/models" })
    model_code?: string;

    @IsInt()
    @IsPositive()
    @IsOptional()
    @ApiPropertyOptional({ example: 720, description: "Optional client-provided value; the backend resolves the category default available answer time automatically when submitting." })
    answer_time?: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AuthenticationPhotoDto)
    @ArrayMinSize(1)
    @ApiProperty({
        type: [AuthenticationPhotoDto],
        description: "Verification photos, one per required index from GET /legitgrails/photo-indexes",
    })
    photos: AuthenticationPhotoDto[];

    @IsString()
    @IsIn(MOCK_OUTCOMES)
    @IsOptional()
    @ApiPropertyOptional({
        enum: MOCK_OUTCOMES,
        description: "Required when LegitGrails is configured with a Test API key; ignored/rejected on Live",
    })
    mock_outcome?: (typeof MOCK_OUTCOMES)[number];
}
