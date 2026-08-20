import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsPositive } from "class-validator";

export class AddToCartDto {
    @IsInt()
    @IsPositive()
    @ApiProperty({ description: "Product ID to add to cart" })
    productId: number;
}
