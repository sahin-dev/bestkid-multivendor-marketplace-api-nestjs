import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl } from "class-validator";

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

export class CheckoutSummaryQueryDto {
    @Transform(({ value }) => toNumberArray(value))
    @IsArray()
    @IsInt({ each: true })
    @IsOptional()
    @ApiPropertyOptional({
        type: [Number],
        description: "Selected seller IDs to include in the checkout summary. Omit to preview the full cart.",
        example: [7],
    })
    sellerIds?: number[];

    @Transform(({ value }) => toNumberArray(value))
    @IsArray()
    @IsInt({ each: true })
    @IsOptional()
    @ApiPropertyOptional({
        type: [Number],
        description: "Exact cart item IDs to include in checkout. Use this for selected products from cart.",
        example: [14, 18],
    })
    cartItemIds?: number[];

    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @ApiPropertyOptional({ description: "Saved address ID used to resolve delivery and preselect the delivery address" })
    addressId?: number;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ description: "Destination country when no saved address is selected", example: "Bulgaria" })
    country?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ description: "Coupon code to preview in the checkout summary", example: "KIDS20" })
    couponCode?: string;
}

export class ApplyCouponDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Coupon code entered by the buyer", example: "KIDS20" })
    couponCode: string;
}

export class CreateStripeCheckoutSessionDto {
    @IsUrl({ require_tld: false })
    @ApiProperty({ description: "Frontend URL Stripe redirects to after successful payment" })
    successUrl: string;

    @IsUrl({ require_tld: false })
    @ApiProperty({ description: "Frontend URL Stripe redirects to when the buyer cancels payment" })
    cancelUrl: string;

    @Transform(({ value }) => toNumberArray(value))
    @IsArray()
    @IsInt({ each: true })
    @IsOptional()
    @ApiPropertyOptional({
        type: [Number],
        description: "Selected seller IDs to include in this payment session. Omit to pay for the full cart.",
        example: [7],
    })
    sellerIds?: number[];

    @Transform(({ value }) => toNumberArray(value))
    @IsArray()
    @IsInt({ each: true })
    @IsOptional()
    @ApiPropertyOptional({
        type: [Number],
        description: "Exact cart item IDs to include in this payment session. Use this for selected products from cart.",
        example: [14, 18],
    })
    cartItemIds?: number[];

    @Type(() => Number)
    @IsInt()
    @ApiProperty({ description: "Saved address ID selected on checkout page" })
    addressId: number;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ description: "Coupon code to apply to the Stripe checkout total", example: "KIDS20" })
    couponCode?: string;

    @IsBoolean()
    @ApiProperty({ description: "Buyer must accept Terms & Conditions and Privacy Policy before payment" })
    acceptedTerms: boolean;
}

export class BuyNowCheckoutSummaryDto {
    @Type(() => Number)
    @IsInt()
    @ApiProperty({ description: "Product ID selected from the product details page" })
    productId: number;

    @Type(() => Number)
    @IsInt()
    @IsOptional()
    @ApiPropertyOptional({ description: "Saved address ID selected for direct checkout" })
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
    @ApiPropertyOptional({ description: "Postal code" })
    postalCode?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ description: "Country code (e.g. US, BD). Required when addressId is not provided." })
    country?: string;
}

export class CreateBuyNowCheckoutSessionDto extends BuyNowCheckoutSummaryDto {
    @IsUrl({ require_tld: false })
    @ApiProperty({ description: "Frontend URL Stripe redirects to after successful payment" })
    successUrl: string;

    @IsUrl({ require_tld: false })
    @ApiProperty({ description: "Frontend URL Stripe redirects to when the buyer cancels payment" })
    cancelUrl: string;

    @IsBoolean()
    @ApiProperty({ description: "Buyer must accept Terms & Conditions and Privacy Policy before payment" })
    acceptedTerms: boolean;
}
