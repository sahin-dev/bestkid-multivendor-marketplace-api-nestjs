import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsStrongPassword } from "class-validator"

export class UpdatePasswordDto {

    @ApiProperty({ description: "Current password", example: "OldPassword123!" })
    @IsString()
    @IsNotEmpty()
    currentPassword:string

    @ApiProperty({ description: "New password", example: "NewPassword123!" })
    @IsString()
    @IsNotEmpty()
    @IsStrongPassword()
    newpassword:string

    @ApiProperty({ description: "Confirm new password", example: "NewPassword123!" })
    @IsString()
    @IsNotEmpty()
    @IsStrongPassword()
    confirmPassword:string
}