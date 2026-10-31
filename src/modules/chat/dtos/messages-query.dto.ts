import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Min, Max } from "class-validator";

export class MessagesQueryDto {
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
    @ApiPropertyOptional({ default: 20 })
    @Max(100)
    limit?: number = 20;
}
