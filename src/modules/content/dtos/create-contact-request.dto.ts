import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class CreateContactRequestDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Sender's name" })
    name: string;

    @IsEmail()
    @IsNotEmpty()
    @ApiProperty({ description: "Sender's email address" })
    email: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Sender's phone number" })
    phone: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Subject of the message" })
    subject: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Message content" })
    message: string;
}
