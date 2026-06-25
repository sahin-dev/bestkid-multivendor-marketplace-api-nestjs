import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty } from "class-validator";
import { ReturnStatus } from "generated/prisma/client";

export class UpdateReturnStatusDto {
    @IsEnum(ReturnStatus)
    @IsNotEmpty()
    @ApiProperty({ enum: ReturnStatus, description: "New return status" })
    status: ReturnStatus;
}
