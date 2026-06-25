import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class OnboardSellerDto {
    @IsString()
    @IsOptional()
    @ApiProperty({ required: false, description: "Return URL after Stripe onboarding completes" })
    returnUrl?: string;

    @IsString()
    @IsOptional()
    @ApiProperty({ required: false, description: "Refresh URL if onboarding link expires" })
    refreshUrl?: string;
}
