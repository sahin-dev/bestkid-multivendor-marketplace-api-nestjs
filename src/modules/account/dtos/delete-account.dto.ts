import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class DeleteAccountDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Current account password" })
    password: string;
}
