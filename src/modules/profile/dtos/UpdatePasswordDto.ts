import { IsNotEmpty, IsString, IsStrongPassword } from "class-validator"

export class UpdatePasswordDto {

    @IsString()
    @IsNotEmpty()
    currentPassword:string

    @IsString()
    @IsNotEmpty()
    @IsStrongPassword()
    newpassword:string

    @IsString()
    @IsNotEmpty()
    @IsStrongPassword()
    confirmPassword:string
}