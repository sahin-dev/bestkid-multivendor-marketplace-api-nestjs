import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class SubmitProductAuthenticationDto {
    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ description: "Seller/admin note sent with the authentication request" })
    notes?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ description: "Requested turnaround/service level if supported by LegitGrails" })
    turnaround?: string;
}
