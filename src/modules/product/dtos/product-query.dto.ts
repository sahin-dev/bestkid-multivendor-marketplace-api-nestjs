import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min } from "class-validator";
import { Condition, ProductStatus } from "generated/prisma/client";

export class ProductQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @ApiPropertyOptional({ default: 1, description: "Page number" })
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @ApiPropertyOptional({ default: 10, description: "Number of items per page" })
    limit?: number = 10;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({ description: "Search query for product name or description" })
    search?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @ApiPropertyOptional({ description: "Filter by category ID" })
    categoryId?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @ApiPropertyOptional({ description: "Filter by subcategory ID" })
    subCategoryId?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @ApiPropertyOptional({ description: "Minimum original price" })
    minPrice?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @ApiPropertyOptional({ description: "Maximum original price" })
    maxPrice?: number;

    @IsOptional()
    @IsEnum(ProductStatus)
    @ApiPropertyOptional({ enum: ProductStatus, description: "Filter by product status" })
    status?: ProductStatus;

    @IsOptional()
    @IsEnum(Condition)
    @ApiPropertyOptional({ enum: Condition, description: "Filter by product condition" })
    condition?: Condition;
}
