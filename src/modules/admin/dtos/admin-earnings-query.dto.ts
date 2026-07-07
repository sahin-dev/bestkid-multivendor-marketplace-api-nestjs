import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Min } from "class-validator";
import { AdminPeriod } from "./admin-period-query.dto";

export class AdminEarningsQueryDto {
    @IsOptional()
    @IsEnum(AdminPeriod)
    @ApiPropertyOptional({ enum: AdminPeriod, default: AdminPeriod.TODAY })
    period?: AdminPeriod = AdminPeriod.TODAY;

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
