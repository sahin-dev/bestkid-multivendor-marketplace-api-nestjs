import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";
import { CouponDiscountType, CouponUsageType } from "generated/prisma/client";

export enum CouponStatusFilter {
    ALL = "ALL",
    ACTIVE = "ACTIVE",
    EXPIRED = "EXPIRED",
    INACTIVE = "INACTIVE",
}

export class CouponQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @ApiPropertyOptional({ default: 1 })
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @ApiPropertyOptional({ default: 10 })
    limit?: number = 10;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({ description: "Search by coupon code or campaign reason" })
    search?: string;

    @IsOptional()
    @IsEnum(CouponStatusFilter)
    @ApiPropertyOptional({ enum: CouponStatusFilter })
    status?: CouponStatusFilter;

    @IsOptional()
    @IsEnum(CouponDiscountType)
    @ApiPropertyOptional({ enum: CouponDiscountType })
    discount_type?: CouponDiscountType;

    @IsOptional()
    @IsEnum(CouponUsageType)
    @ApiPropertyOptional({ enum: CouponUsageType })
    usage_type?: CouponUsageType;
}
