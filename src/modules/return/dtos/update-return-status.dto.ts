import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from "class-validator";
import { ReturnStatus } from "generated/prisma/client";

export class UpdateReturnStatusDto {
    @IsEnum(ReturnStatus)
    @IsNotEmpty()
    @ApiProperty({ enum: ReturnStatus, description: "New return status" })
    status: ReturnStatus;

    @IsString()
    @IsOptional()
    @MaxLength(1000)
    @ApiProperty({ required: false, description: "Seller/admin response visible to the buyer" })
    seller_response?: string;

    @IsString()
    @IsOptional()
    @MaxLength(1000)
    @ApiProperty({ required: false, description: "Required when rejecting a return" })
    seller_rejection_reason?: string;

    @IsString()
    @IsOptional()
    @MaxLength(1000)
    @ApiProperty({ required: false, description: "Return shipping address/instructions" })
    return_address?: string;

    @IsNumber()
    @IsPositive()
    @IsOptional()
    @ApiProperty({ required: false, description: "Refund amount when completing a return" })
    refund_amount?: number;
}
