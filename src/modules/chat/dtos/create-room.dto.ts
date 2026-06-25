import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber } from "class-validator";

export class CreateRoomDto {
    @IsNumber()
    @IsNotEmpty()
    @ApiProperty({ description: "Seller ID to start/find a chat room with" })
    sellerId: number;
}
