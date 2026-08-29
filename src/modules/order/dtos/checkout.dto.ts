import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsArray, IsBoolean, IsInt, IsOptional, IsString } from "class-validator";

function toNumberArray(value: unknown) {
    if (Array.isArray(value)) {
        return value.map(Number);
    }
    if (typeof value === "string") {
        return value
            .split(",")
            .map((item) => Number(item.trim()))
            .filter((item) => !Number.isNaN(item));
    }
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    return [Number(value)];
}

export class CheckoutDto {
    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ description: "Shipping address. Required when addressId is not provided." })
    shippingAddress?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ description: "City. Required when addressId is not provided." })
    city?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ description: "Postal code" })
    postalCode?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ description: "Country code (e.g. US, BD). Required when addressId is not provided." })
    country?: string;

    @Transform(({ value }) => toNumberArray(value))
    @IsArray()
    @IsInt({ each: true })
    @IsOptional()
    @ApiPropertyOptional({
        type: [Number],
        description: "Selected seller IDs to checkout. Omit to checkout the full cart.",
        example: [7],
    })
    sellerIds?: number[];

    @Transform(({ value }) => toNumberArray(value))
    @IsArray()
    @IsInt({ each: true })
    @IsOptional()
    @ApiPropertyOptional({
        type: [Number],
        description: "Exact cart item IDs to checkout. Use this for selected products from cart.",
        example: [14, 18],
    })
    cartItemIds?: number[];

    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @ApiPropertyOptional({ description: "Saved address ID selected on checkout page" })
    addressId?: number;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ description: "Coupon code to apply during checkout", example: "KIDS20" })
    couponCode?: string;

    @IsBoolean()
    @IsOptional()
    @ApiPropertyOptional({ description: "Whether the buyer accepted Terms & Conditions and Privacy Policy" })
    acceptedTerms?: boolean;
}
