import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    IsBoolean,
    IsDateString,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Min,
} from "class-validator";

export class CreateHomeBannerDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: "Get 5% OFF" })
    title: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ example: "Kids Sneakers" })
    subtitle?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({
        example: "Valid for all kids sneakers products for a limited time.",
    })
    description?: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: "/uploads/home-banner-1.png" })
    image_url: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ example: "Shop Now", default: "Shop Now" })
    button_text?: string;

    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @ApiPropertyOptional({ description: "Target category ID for banner button" })
    categoryId?: number;

    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @ApiPropertyOptional({ description: "Target sub-category ID for banner button" })
    subCategoryId?: number;

    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @ApiPropertyOptional({ description: "Featured coupon shown on this banner" })
    couponId?: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    @IsOptional()
    @ApiPropertyOptional({ default: 0 })
    sort_order?: number;

    @IsBoolean()
    @IsOptional()
    @ApiPropertyOptional({ default: true })
    is_active?: boolean;

    @IsDateString()
    @IsOptional()
    @ApiPropertyOptional({ example: "2026-08-25T00:00:00.000Z" })
    start_date?: string;

    @IsDateString()
    @IsOptional()
    @ApiPropertyOptional({ example: "2026-09-25T23:59:59.000Z" })
    end_date?: string;
}

export class UpdateHomeBannerDto {
    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ example: "Get 10% OFF" })
    title?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ example: "Back to School" })
    subtitle?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional()
    description?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ example: "/uploads/home-banner-2.png" })
    image_url?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ example: "Shop Now" })
    button_text?: string;

    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @ApiPropertyOptional()
    categoryId?: number;

    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @ApiPropertyOptional()
    subCategoryId?: number;

    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @ApiPropertyOptional()
    couponId?: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    @IsOptional()
    @ApiPropertyOptional()
    sort_order?: number;

    @IsBoolean()
    @IsOptional()
    @ApiPropertyOptional()
    is_active?: boolean;

    @IsDateString()
    @IsOptional()
    @ApiPropertyOptional()
    start_date?: string;

    @IsDateString()
    @IsOptional()
    @ApiPropertyOptional()
    end_date?: string;
}
