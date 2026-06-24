import { ApiProperty } from "@nestjs/swagger"
import { IsEmail, IsNotEmpty, IsString } from "class-validator"

export class ResendOtpDto {

    @IsString()
    @IsEmail()
    @IsNotEmpty()
    @ApiProperty()
    email: string

}