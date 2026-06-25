import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreateReturnDto {
    @IsNumber()
    @IsNotEmpty()
    @ApiProperty({ description: "Order item ID to return" })
    orderItemId: number;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Reason for the return" })
    reason: string;

    @IsArray()
    @IsString({ each: true })
    @ApiProperty({ type: [String], description: "List of image URLs showing proof" })
    images: string[];
}
