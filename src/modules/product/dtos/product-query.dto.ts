import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import { AuthenticationStatus, Condition, ProductStatus } from "generated/prisma/client";

export enum ProductSort {
    LATEST = "latest",
    PRICE_LOW = "price_low",
    PRICE_HIGH = "price_high",
    RATING = "rating",
    POPULAR = "popular",
}

export enum SellerProductStatus {
    UNDER_REVIEW = "under_review",
    LIVE = "live",
    ACTION_REQUIRED = "action_required",
    REJECTED = "rejected",
    SOLD = "sold",
    INACTIVE = "inactive",
}

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
    @IsInt()
    @ApiPropertyOptional({ description: "Filter by seller ID" })
    sellerId?: number;

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
    @IsEnum(SellerProductStatus)
    @ApiPropertyOptional({ enum: SellerProductStatus, description: "Filter by derived seller-facing product status" })
    sellerStatus?: SellerProductStatus;

    @IsOptional()
    @IsEnum(AuthenticationStatus)
    @ApiPropertyOptional({ enum: AuthenticationStatus, description: "Filter by product authentication/moderation status" })
    authenticationStatus?: AuthenticationStatus;

    @IsOptional()
    @IsEnum(Condition)
    @ApiPropertyOptional({ enum: Condition, description: "Filter by product condition" })
    condition?: Condition;

    @IsOptional()
    @IsEnum(ProductSort)
    @ApiPropertyOptional({ enum: ProductSort, default: ProductSort.LATEST, description: "Sort product results" })
    sort?: ProductSort = ProductSort.LATEST;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(5)
    @ApiPropertyOptional({ description: "Minimum average rating" })
    minRating?: number;

    @IsOptional()
    @Transform(({ value }) => value === true || value === "true")
    @IsBoolean()
    @ApiPropertyOptional({ description: "Only show discounted products" })
    discountedOnly?: boolean;
}
