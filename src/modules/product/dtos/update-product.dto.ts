import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsInt,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    ValidateNested,
} from "class-validator";
import { Condition, ProductStatus } from "generated/prisma/client";
import { ProductVariantInputDto } from "./create-product.dto";

export class UpdateProductDto {
    @IsString()
    @IsOptional()
    @ApiProperty({ required: false, example: "Kids Cotton Hoodie - Soft Fit", description: "Product name" })
    name?: string;

    @IsString()
    @IsOptional()
    @ApiProperty({
        required: false,
        example: "Comfortable and lightweight kids hoodie designed for everyday use.",
        description: "Product description",
    })
    description?: string;

    @IsNumber()
    @IsPositive()
    @IsOptional()
    @ApiProperty({ required: false, example: 21.99, description: "Original price of the product" })
    original_price?: number;

    @IsNumber()
    @IsPositive()
    @IsOptional()
    @ApiProperty({ required: false, example: 18, description: "Discounted price of the product" })
    discounted_price?: number;

    @IsNumber()
    @IsOptional()
    @ApiProperty({ required: false, example: 18, description: "Discount percentage" })
    discount_percentage?: number;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    @ApiProperty({
        required: false,
        type: [String],
        example: ["https://cdn.bestkid.test/products/hoodie-front.png"],
        description: "List of product image URLs",
    })
    image_urls?: string[];

    @IsInt()
    @IsOptional()
    @ApiProperty({ required: false, example: 1, description: "Category ID" })
    categoryId?: number;

    @IsInt()
    @IsOptional()
    @ApiProperty({ required: false, example: 2, description: "Subcategory ID" })
    subCategoryId?: number;

    @IsEnum(Condition)
    @IsOptional()
    @ApiProperty({ required: false, enum: Condition, example: Condition.NEW, description: "Condition of the product" })
    condition?: Condition;

    @IsEnum(ProductStatus)
    @IsOptional()
    @ApiProperty({
        required: false,
        enum: ProductStatus,
        example: ProductStatus.ACTIVE,
        description: "Product status",
    })
    status?: ProductStatus;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ProductVariantInputDto)
    @IsOptional()
    @ApiProperty({
        required: false,
        type: [ProductVariantInputDto],
        example: [{ variantName: "M", price: 18 }],
        description: "Variants to replace or add",
    })
    variants?: ProductVariantInputDto[];

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    @ApiProperty({ required: false, type: [String], example: ["S", "M", "L"], description: "Shorthand variant names" })
    variant_names?: string[];

    @IsBoolean()
    @IsOptional()
    @ApiProperty({
        required: false,
        default: true,
        example: true,
        description: "When variants are submitted, replace existing variants by default",
    })
    replace_variants?: boolean;
}
