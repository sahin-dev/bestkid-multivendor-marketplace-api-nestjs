import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator"

export class SigninDto {

    @IsString()
    @IsEmail()
    @IsNotEmpty()
    @ApiProperty()
    email:string

    @IsString()
    @IsNotEmpty()
    @ApiProperty()
    password:string

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({ description: "Firebase Cloud Messaging token sent by the mobile app after login" })
    fcmToken?: string
}