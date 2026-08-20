import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsInt, IsNotEmpty, IsString, ValidateNested } from "class-validator";

export class OrderItemDto {
    @IsInt()
    @ApiProperty({ description: "Product ID" })
    productId: number;
}

export class CreateOrderDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Shipping address" })
    shippingAddress: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "City" })
    city: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Postal code" })
    postalCode: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Country" })
    country: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OrderItemDto)
    @ApiProperty({ type: [OrderItemDto], description: "List of items in the order" })
    items: OrderItemDto[];
}
