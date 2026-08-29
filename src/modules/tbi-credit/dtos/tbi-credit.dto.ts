import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

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

export class TbiCalculationsQueryDto {
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @IsOptional()
    @ApiPropertyOptional({ description: "Explicit amount to finance. If omitted, pass productId or cart filters." })
    amount?: number;

    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @ApiPropertyOptional({ description: "Product ID for a product-details installment preview." })
    productId?: number;

    @Transform(({ value }) => toNumberArray(value))
    @IsArray()
    @IsInt({ each: true })
    @IsOptional()
    @ApiPropertyOptional({ type: [Number], description: "Selected cart item IDs for cart checkout preview." })
    cartItemIds?: number[];

    @Transform(({ value }) => toNumberArray(value))
    @IsArray()
    @IsInt({ each: true })
    @IsOptional()
    @ApiPropertyOptional({ type: [Number], description: "Selected seller IDs for cart checkout preview." })
    sellerIds?: number[];

    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @ApiPropertyOptional({ description: "TBI category ID override. Defaults to the product category when available." })
    categoryId?: number;

    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @ApiPropertyOptional({ description: "Saved address ID used when calculating a cart or Buy Now total." })
    addressId?: number;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ description: "Destination country when no saved address is selected." })
    country?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ description: "Coupon code to include in the financed checkout total." })
    couponCode?: string;
}

export class CreateTbiCheckoutSessionDto {
    @IsString()
    @ApiProperty({ description: "Frontend/app URL to send the buyer after a successful TBI application." })
    successUrl: string;

    @IsString()
    @ApiProperty({ description: "Frontend/app URL to send the buyer after a failed or cancelled TBI application." })
    failUrl: string;

    @Transform(({ value }) => toNumberArray(value))
    @IsArray()
    @IsInt({ each: true })
    @IsOptional()
    @ApiPropertyOptional({ type: [Number], description: "Selected seller IDs to include. Omit to finance the full cart." })
    sellerIds?: number[];

    @Transform(({ value }) => toNumberArray(value))
    @IsArray()
    @IsInt({ each: true })
    @IsOptional()
    @ApiPropertyOptional({ type: [Number], description: "Exact cart item IDs to include." })
    cartItemIds?: number[];

    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @ApiPropertyOptional({ description: "Saved address ID selected on checkout page." })
    addressId?: number;

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
    @ApiPropertyOptional({ description: "Postal code." })
    postalCode?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ description: "Country code/name. Required when addressId is not provided." })
    country?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ description: "Coupon code to apply to the financed checkout total." })
    couponCode?: string;

    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @ApiPropertyOptional({ description: "Preselected TBI repayment period." })
    period?: number;

    @IsBoolean()
    @IsOptional()
    @ApiPropertyOptional({ description: "Allow TBI BNPL option where supported by the TBI scheme." })
    bnpl?: boolean;

    @IsBoolean()
    @ApiProperty({ description: "Buyer must accept Terms & Conditions and Privacy Policy before financing." })
    acceptedTerms: boolean;
}

export class CreateTbiBuyNowSessionDto extends CreateTbiCheckoutSessionDto {
    @Type(() => Number)
    @IsInt()
    @ApiProperty({ description: "Product ID selected from the product details page." })
    productId: number;
}
