import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CheckoutDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Shipping address" })
    shippingAddress: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "City" })
    city: string;

    @IsString()
    @IsOptional()
    @ApiProperty({ required: false, description: "Postal code" })
    postalCode?: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Country code (e.g. US, BD) — used to resolve domestic vs international delivery" })
    country: string;
}
