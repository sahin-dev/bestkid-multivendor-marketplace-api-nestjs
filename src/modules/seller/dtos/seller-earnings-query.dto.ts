import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Min } from "class-validator";

export enum SellerEarningsPeriod {
    ALL = "ALL",
    TODAY = "TODAY",
    LAST_24_HOURS = "LAST_24_HOURS",
    LAST_WEEK = "LAST_WEEK",
    LAST_FORTNIGHT = "LAST_FORTNIGHT",
    LAST_MONTH = "LAST_MONTH",
    LAST_YEAR = "LAST_YEAR",
}

export class SellerEarningsQueryDto {
    @IsOptional()
    @IsEnum(SellerEarningsPeriod)
    @ApiPropertyOptional({ enum: SellerEarningsPeriod, default: SellerEarningsPeriod.TODAY })
    period?: SellerEarningsPeriod = SellerEarningsPeriod.TODAY;

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
}
