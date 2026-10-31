import { ApiProperty } from "@nestjs/swagger"
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator"

export class RegisterUserDto {

    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    @ApiProperty()
    fullName: string

    @IsString()
    @IsEmail()
    @IsNotEmpty()
    @ApiProperty()
    email: string

    @IsString()
    @IsNotEmpty()
    @MaxLength(30)
    @ApiProperty()
    phone: string

    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @MaxLength(72)
    @ApiProperty()
    password: string

    @IsString()
    @IsNotEmpty()
    @ApiProperty()
    confirmPassword: string

}