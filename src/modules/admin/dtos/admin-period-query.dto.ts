import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";

export enum AdminPeriod {
    ALL = "ALL",
    TODAY = "TODAY",
    LAST_24_HOURS = "LAST_24_HOURS",
    LAST_WEEK = "LAST_WEEK",
    LAST_FORTNIGHT = "LAST_FORTNIGHT",
    LAST_MONTH = "LAST_MONTH",
    LAST_YEAR = "LAST_YEAR",
}

export class AdminPeriodQueryDto {
    @IsOptional()
    @IsEnum(AdminPeriod)
    @ApiPropertyOptional({ enum: AdminPeriod, default: AdminPeriod.TODAY })
    period?: AdminPeriod = AdminPeriod.TODAY;
}
