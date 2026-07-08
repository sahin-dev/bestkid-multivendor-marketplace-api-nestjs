import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateReturnDto {
    @IsNumber()
    @IsNotEmpty()
    @ApiProperty({ description: "Order item ID to return" })
    orderItemId: number;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Reason for the return" })
    reason: string;

    @IsString()
    @IsOptional()
    @ApiProperty({ required: false, description: "Detailed message for the seller" })
    message?: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    @ApiProperty({ type: [String], description: "List of image URLs showing proof" })
    images?: string[];
}
