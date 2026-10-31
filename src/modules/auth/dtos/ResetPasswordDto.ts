import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class ResetPasswordDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "OTP request ID" })
    requestId: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @MaxLength(72)
    @ApiProperty({ description: "New password" })
    newPassword: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Confirm new password" })
    confirmPassword: string;
}
