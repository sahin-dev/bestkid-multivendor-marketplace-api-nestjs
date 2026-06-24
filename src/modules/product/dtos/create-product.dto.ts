import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from "class-validator";
import { Condition, ProductStatus } from "generated/prisma/client";

export class CreateProductDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Product name" })
    name: string;

    @IsString()
    @IsOptional()
    @ApiProperty({ required: false, description: "Product description" })
    description?: string;

    @IsNumber()
    @IsPositive()
    @ApiProperty({ description: "Original price of the product" })
    original_price: number;

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
    @ApiProperty({ description: "Category ID" })
    categoryId: number;

    @IsInt()
    @ApiProperty({ description: "Subcategory ID" })
    subCategoryId: number;

    @IsEnum(Condition)
    @IsOptional()
    @ApiProperty({ required: false, enum: Condition, default: Condition.NEW, description: "Condition of the product" })
    condition?: Condition;

    @IsEnum(ProductStatus)
    @IsOptional()
    @ApiProperty({ required: false, enum: ProductStatus, default: ProductStatus.INACTIVE, description: "Product status" })
    status?: ProductStatus;
}
