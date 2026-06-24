import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsPositive, IsString } from "class-validator";

export class CreateVariantDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Name of the product variant (e.g. Size, Color)" })
    variantName: string;

    @IsNumber()
    @IsPositive()
    @ApiProperty({ description: "Price of the product variant" })
    price: number;
}
