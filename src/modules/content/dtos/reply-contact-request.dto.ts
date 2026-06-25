import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class ReplyContactRequestDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Response reply message content" })
    reply: string;
}
