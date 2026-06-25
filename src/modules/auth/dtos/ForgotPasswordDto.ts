import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty } from "class-validator";

export class ForgotPasswordDto {
    @IsEmail()
    @IsNotEmpty()
    @ApiProperty({ description: "User email address" })
    email: string;
}
