import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Min, Max } from "class-validator";

export class NotificationQueryDto {
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
    @Max(100)
    limit?: number = 10;
}
