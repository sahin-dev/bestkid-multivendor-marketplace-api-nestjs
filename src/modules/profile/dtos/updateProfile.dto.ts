import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator"

export class UpdateProfileDto{

    @ApiPropertyOptional({ description: "User full name", example: "John Doe" })
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    full_name?:string

    @ApiPropertyOptional({ description: "User phone number", example: "+8801712345678" })
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    phone?:string
}