import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsPositive, Min } from "class-validator";

export class AddToCartDto {
    @IsInt()
    @IsPositive()
    @ApiProperty({ description: "Product ID to add to cart" })
    productId: number;

    @IsInt()
    @IsPositive()
    @ApiProperty({ description: "Product variant ID" })
    variantId: number;

    @IsInt()
    @Min(1)
    @ApiProperty({ description: "Quantity", default: 1 })
    quantity: number;
}
