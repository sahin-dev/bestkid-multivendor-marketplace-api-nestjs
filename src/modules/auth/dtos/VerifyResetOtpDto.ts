import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class VerifyResetOtpDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "OTP request ID" })
    requestId: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "OTP code" })
    otp: string;
}
