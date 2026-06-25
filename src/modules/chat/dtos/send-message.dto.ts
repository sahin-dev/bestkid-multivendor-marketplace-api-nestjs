import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { MessageType } from "generated/prisma/client";

export class SendMessageDto {
    @IsNumber()
    @IsNotEmpty()
    @ApiProperty({ description: "Chat room ID" })
    chatRoomId: number;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ description: "Message content text" })
    message?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ description: "Attached file URL if any" })
    file_url?: string;

    @IsEnum(MessageType)
    @IsNotEmpty()
    @ApiProperty({ enum: MessageType, default: MessageType.TEXT })
    type: MessageType;
}
