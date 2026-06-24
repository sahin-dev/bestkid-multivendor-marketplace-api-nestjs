import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString } from "class-validator";
import { Condition, ProductStatus } from "generated/prisma/client";

export class UpdateProductDto {
    @IsString()
    @IsOptional()
    @ApiProperty({ required: false, description: "Product name" })
    name?: string;

    @IsString()
    @IsOptional()
    @ApiProperty({ required: false, description: "Product description" })
    description?: string;

    @IsNumber()
    @IsPositive()
    @IsOptional()
    @ApiProperty({ required: false, description: "Original price of the product" })
    original_price?: number;

    @IsNumber()
    @IsPositive()
    @IsOptional()
    @ApiProperty({ required: false, description: "Discounted price of the product" })
    discounted_price?: number;

    @IsNumber()
    @IsPositive()
    @IsOptional()
    @ApiProperty({ required: false, description: "Discount percentage" })
    discount_percentage?: number;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    @ApiProperty({ required: false, type: [String], description: "List of product image URLs" })
    image_urls?: string[];

    @IsInt()
    @IsOptional()
    @ApiProperty({ required: false, description: "Category ID" })
    categoryId?: number;

    @IsInt()
    @IsOptional()
    @ApiProperty({ required: false, description: "Subcategory ID" })
    subCategoryId?: number;

    @IsEnum(Condition)
    @IsOptional()
    @ApiProperty({ required: false, enum: Condition, description: "Condition of the product" })
    condition?: Condition;

    @IsEnum(ProductStatus)
    @IsOptional()
    @ApiProperty({ required: false, enum: ProductStatus, description: "Product status" })
    status?: ProductStatus;
}
