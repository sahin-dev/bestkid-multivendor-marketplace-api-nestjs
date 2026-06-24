import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { OrderStatus } from "generated/prisma/client";

export class UpdateOrderStatusDto {
    @IsEnum(OrderStatus)
    @ApiProperty({ enum: OrderStatus, description: "New status of the order" })
    status: OrderStatus;
}
