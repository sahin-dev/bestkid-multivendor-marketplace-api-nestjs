import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";
import { AuthenticationStatus, ProductStatus } from "generated/prisma/client";

export enum AdminProductApprovalFilter {
    ALL = "ALL",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    PENDING = "PENDING",
}

export class AdminProductQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @ApiPropertyOptional({ default: 1 })
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @ApiPropertyOptional({ default: 10 })
    limit?: number = 10;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({ description: "Search by product name or description" })
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
    @ApiPropertyOptional({ description: "Filter by seller/user ID" })
    sellerId?: number;

    @IsOptional()
    @IsEnum(ProductStatus)
    @ApiPropertyOptional({ enum: ProductStatus, description: "Filter by sale status" })
    status?: ProductStatus;

    @IsOptional()
    @IsEnum(AuthenticationStatus)
    @ApiPropertyOptional({ enum: AuthenticationStatus, description: "Filter by authentication/moderation status" })
    authenticationStatus?: AuthenticationStatus;

    @IsOptional()
    @IsEnum(AdminProductApprovalFilter)
    @ApiPropertyOptional({
        enum: AdminProductApprovalFilter,
        description: "Design-friendly approval filter. Maps APPROVED/REJECTED/PENDING to authentication status.",
    })
    approval?: AdminProductApprovalFilter;
}
