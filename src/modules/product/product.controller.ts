import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { GetUser, Public, Roles } from "src/common/decorators";
import { ProductService } from "./product.service";
import { CreateProductDto } from "./dtos/create-product.dto";
import { UpdateProductDto } from "./dtos/update-product.dto";
import { CreateReviewDto } from "./dtos/create-review.dto";
import { ProductQueryDto, SellerProductStatus } from "./dtos/product-query.dto";
import { UpdateProductAuthStatusDto } from "./dtos/update-product-auth-status.dto";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { AdminProductApprovalFilter, AdminProductQueryDto } from "./dtos/admin-product-query.dto";
import { AuthenticationStatus, ProductStatus } from "generated/prisma/client";
import type { Request } from "express";
import { TokenPayload } from "../auth/types/TokenPayload.type";
import { UpdateProductStatusDto } from "./dtos/update-product-status.dto";

@ApiTags("Products")
@Controller("products")
export class ProductController {
    constructor(private readonly productService: ProductService) {}

    @Post()
    @ApiBearerAuth("access-token")
    @Roles("ADMIN", "USER")
    @ApiOperation({ summary: "Create a product listing", description: "Any authenticated user can sell after Stripe onboarding is complete. Product starts with its submitted sale/moderation status." })
    @ApiBody({ type: CreateProductDto })
    @ApiResponse({ status: 201, description: "Product listing created" })
    async createProduct(@GetUser("id") userId: number, @Body() dto: CreateProductDto) {
        return this.productService.createProduct(userId, dto);
    }

    @Get()
    @Public()
    @ApiOperation({ summary: "List public products" })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    @ApiQuery({ name: "categoryId", required: false, type: Number })
    @ApiQuery({ name: "subCategoryId", required: false, type: Number })
    @ApiQuery({ name: "sellerId", required: false, type: Number })
    @ApiQuery({ name: "search", required: false, type: String })
    @ApiQuery({ name: "minPrice", required: false, type: Number })
    @ApiQuery({ name: "maxPrice", required: false, type: Number })
    @ApiQuery({ name: "condition", required: false, enum: ["NEW", "USED", "REFURBISHED"] })
    @ApiQuery({ name: "sort", required: false, enum: ["latest", "price_low", "price_high", "rating", "popular"] })
    @ApiQuery({ name: "minRating", required: false, type: Number })
    @ApiQuery({ name: "discountedOnly", required: false, type: Boolean })
    async findAllProducts(@Query() query: ProductQueryDto, @Req() req: Request) {
        const user = req["payload"] as { id: number } | undefined;
        return this.productService.findAllProducts(query, user?.id);
    }

    @Get("admin/all")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiOperation({ summary: "Admin: list products with status and moderation filters" })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    @ApiQuery({ name: "categoryId", required: false, type: Number })
    @ApiQuery({ name: "subCategoryId", required: false, type: Number })
    @ApiQuery({ name: "sellerId", required: false, type: Number })
    @ApiQuery({ name: "search", required: false, type: String })
    @ApiQuery({ name: "status", required: false, enum: ["ACTIVE", "INACTIVE", "SOLD"] })
    @ApiQuery({ name: "authenticationStatus", required: false, enum: AuthenticationStatus })
    @ApiQuery({ name: "approval", required: false, enum: AdminProductApprovalFilter })
    async findAllProductsAdmin(@Query() query: AdminProductQueryDto) {
        return this.productService.findAllProductsAdmin(query);
    }

    @Get("seller/my")
    @ApiBearerAuth("access-token")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "Seller: list my products for active/inactive product tabs" })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    @ApiQuery({ name: "search", required: false, type: String })
    @ApiQuery({ name: "status", required: false, enum: ProductStatus })
    @ApiQuery({ name: "sellerStatus", required: false, enum: SellerProductStatus })
    @ApiQuery({ name: "authenticationStatus", required: false, enum: AuthenticationStatus })
    @ApiQuery({ name: "sort", required: false, enum: ["latest", "price_low", "price_high", "rating", "popular"] })
    async findSellerProducts(@GetUser("id") sellerId: number, @Query() query: ProductQueryDto) {
        return this.productService.findSellerProducts(sellerId, query);
    }

    @Get("seller/:id")
    @ApiBearerAuth("access-token")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "Seller: get one of my product listings" })
    @ApiParam({ name: "id", type: Number })
    async findSellerProductById(
        @Param("id", ParseIntPipe) productId: number,
        @GetUser() payload: TokenPayload,
    ) {
        const response =  await this.productService.findSellerProductById(productId, payload.id, payload.role === "ADMIN");
        return response;
    }

    @Patch("seller/:id/status")
    @ApiBearerAuth("access-token")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "Seller: mark a product active (requires LegitGrails verification), inactive, or sold" })
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: UpdateProductStatusDto })
    async updateSellerProductStatus(
        @Param("id", ParseIntPipe) productId: number,
        @Body() dto: UpdateProductStatusDto,
        @GetUser() payload: TokenPayload,
    ) {
        return this.productService.updateSellerProductStatus(productId, payload.id, dto.status, payload.role === "ADMIN");
    }

    @Patch("admin/:id/auth-status")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiOperation({ summary: "Admin: approve, reject, or reset product moderation status" })
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: UpdateProductAuthStatusDto })
    async updateProductAuthStatusAdmin(
        @Param("id", ParseIntPipe) productId: number,
        @Body() dto: UpdateProductAuthStatusDto,
    ) {
        return this.productService.updateProductAuthStatusAdmin(productId, dto.status);
    }

    @Get(":id")
    @Public()
    @ApiOperation({ summary: "Get product details" })
    @ApiParam({ name: "id", type: Number })
    async findProductById(@Param("id", ParseIntPipe) id: number, @Req() req: Request) {
        const user = req["payload"] as { id?: number; role?: string } | undefined;
        return this.productService.findProductById(id, user?.id, user?.role === "ADMIN");
    }

    @Patch(":id")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN", "USER")
    @ApiOperation({ summary: "Update a product listing" })
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: UpdateProductDto })
    async updateProduct(
        @Param("id", ParseIntPipe) id: number,
        @Body() dto: UpdateProductDto,
        @GetUser() payload: TokenPayload,
    ) {
        return this.productService.updateProduct(id, dto, payload.id, payload.role === "ADMIN");
    }

    @Delete(":id")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN", "USER")
    @ApiOperation({ summary: "Delete a product listing" })
    @ApiParam({ name: "id", type: Number })
    async deleteProduct(@Param("id", ParseIntPipe) id: number, @GetUser() payload: TokenPayload) {
        return this.productService.deleteProduct(id, payload.id, payload.role === "ADMIN");
    }

    @Post(":id/reviews")
    @ApiBearerAuth("access-token")
    @ApiOperation({ summary: "Create a product review", description: "Adds a rating/review and recalculates product average rating." })
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: CreateReviewDto })
    async createReview(
        @Param("id", ParseIntPipe) productId: number,
        @GetUser("id") userId: number,
        @Body() dto: CreateReviewDto,
    ) {
        return this.productService.createReview(productId, userId, dto);
    }

    @Get(":id/reviews")
    @Public()
    @ApiOperation({ summary: "List product reviews" })
    @ApiParam({ name: "id", type: Number })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    async findReviews(@Param("id", ParseIntPipe) productId: number, @Query() query: PaginationDto) {
        return this.productService.findReviews(productId, query);
    }

}
