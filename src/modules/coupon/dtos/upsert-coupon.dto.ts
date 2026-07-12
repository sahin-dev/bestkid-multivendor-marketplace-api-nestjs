import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { CouponDiscountType, CouponUsageType } from "generated/prisma/enums";

export class CreateCouponDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: "Christmas Sale" })
    campaign_reason: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: "KIDS10" })
    code: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @ApiPropertyOptional({ description: "Category ID for the coupon scope" })
    categoryId?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @ApiPropertyOptional({ description: "Sub-category ID for the coupon scope" })
    subCategoryId?: number;

    @IsEnum(CouponDiscountType)
    @ApiProperty({ enum: CouponDiscountType })
    discount_type: CouponDiscountType;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @ApiProperty({ example: 10, description: "Percentage value or fixed amount depending on discount_type" })
    discount_value: number;

    @IsEnum(CouponUsageType)
    @ApiProperty({ enum: CouponUsageType, default: CouponUsageType.UNLIMITED })
    usage_type: CouponUsageType = CouponUsageType.UNLIMITED;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @ApiPropertyOptional({ example: 100, description: "Required when usage_type is LIMITED" })
    usage_limit?: number;

    @IsDateString()
    @ApiProperty({ example: "2026-07-14T00:00:00.000Z" })
    start_date: string;

    @IsDateString()
    @ApiProperty({ example: "2026-07-24T23:59:59.000Z" })
    end_date: string;

    @IsOptional()
    @IsBoolean()
    @ApiPropertyOptional({ default: true })
    is_active?: boolean;
}

export class UpdateCouponDto {
    @IsOptional()
    @IsString()
    @ApiPropertyOptional({ example: "Summer Sale" })
    campaign_reason?: string;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({ example: "KIDS15" })
    code?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @ApiPropertyOptional()
    categoryId?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @ApiPropertyOptional()
    subCategoryId?: number;

    @IsOptional()
    @IsEnum(CouponDiscountType)
    @ApiPropertyOptional({ enum: CouponDiscountType })
    discount_type?: CouponDiscountType;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @ApiPropertyOptional()
    discount_value?: number;

    @IsOptional()
    @IsEnum(CouponUsageType)
    @ApiPropertyOptional({ enum: CouponUsageType })
    usage_type?: CouponUsageType;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @ApiPropertyOptional()
    usage_limit?: number;

    @IsOptional()
    @IsDateString()
    @ApiPropertyOptional()
    start_date?: string;

    @IsOptional()
    @IsDateString()
    @ApiPropertyOptional()
    end_date?: string;

    @IsOptional()
    @IsBoolean()
    @ApiPropertyOptional()
    is_active?: boolean;
}
