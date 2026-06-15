import { ApiProperty } from "@nestjs/swagger"
import { IsNotEmpty, IsString } from "class-validator"

export class verifyOtpDto {

    @IsString()
    @IsNotEmpty()
    @ApiProperty()
    requestId:string

    @IsString()
    @IsNotEmpty()
    @ApiProperty()
    otp:string

}