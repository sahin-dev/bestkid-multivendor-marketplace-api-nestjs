import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class CancelOrderDto {
    @IsOptional()
    @IsString()
    @MaxLength(500)
    @ApiPropertyOptional({ description: "Optional cancellation reason" })
    reason?: string;
}
