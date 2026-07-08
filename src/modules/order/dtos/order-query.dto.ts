import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Min } from "class-validator";
import { OrderStatus } from "generated/prisma/client";

export enum BuyerOrderTab {
    ACTIVE = "ACTIVE",
    COMPLETE = "COMPLETE",
    CANCELED = "CANCELED",
}

export enum SellerOrderTab {
    ORDER_PLACED = "ORDER_PLACED",
    CONFIRMED = "CONFIRMED",
    SHIPPED = "SHIPPED",
    DELIVERED = "DELIVERED",
    CANCELED = "CANCELED",
}

export class OrderQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @ApiPropertyOptional({ default: 1, description: "Page number" })
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @ApiPropertyOptional({ default: 10, description: "Number of items per page" })
    limit?: number = 10;

    @IsOptional()
    @IsEnum(OrderStatus)
    @ApiPropertyOptional({ enum: OrderStatus, description: "Filter by order status" })
    status?: OrderStatus;

    @IsOptional()
    @IsEnum(BuyerOrderTab)
    @ApiPropertyOptional({ enum: BuyerOrderTab, description: "Buyer UI tab filter" })
    tab?: BuyerOrderTab;

    @IsOptional()
    @IsEnum(SellerOrderTab)
    @ApiPropertyOptional({ enum: SellerOrderTab, description: "Seller customer-order UI tab filter" })
    sellerTab?: SellerOrderTab;
}
