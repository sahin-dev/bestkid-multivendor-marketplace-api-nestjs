import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { GetUser, Public, Roles } from "src/common/decorators";
import { ProductService } from "./product.service";
import { CreateProductDto } from "./dtos/create-product.dto";
import { UpdateProductDto } from "./dtos/update-product.dto";
import { CreateVariantDto } from "./dtos/create-variant.dto";
import { CreateReviewDto } from "./dtos/create-review.dto";
import { ProductQueryDto } from "./dtos/product-query.dto";
import { UpdateProductAuthStatusDto } from "./dtos/update-product-auth-status.dto";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { AdminProductApprovalFilter, AdminProductQueryDto } from "./dtos/admin-product-query.dto";
import { AuthenticationStatus } from "generated/prisma/client";

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
    @ApiQuery({ name: "sellerId", required: false, type: Number })
    @ApiQuery({ name: "search", required: false, type: String })
    async findAllProducts(@Query() query: ProductQueryDto) {
        return this.productService.findAllProducts(query);
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
    @ApiQuery({ name: "status", required: false, enum: ["ACTIVE", "INACTIVE", "OUT_OF_STOCK"] })
    @ApiQuery({ name: "authenticationStatus", required: false, enum: AuthenticationStatus })
    @ApiQuery({ name: "approval", required: false, enum: AdminProductApprovalFilter })
    async findAllProductsAdmin(@Query() query: AdminProductQueryDto) {
        return this.productService.findAllProductsAdmin(query);
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
        const user = req["user"] as { id: number } | undefined;
        return this.productService.findProductById(id, user?.id);
    }

    @Patch(":id")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN", "USER")
    @ApiOperation({ summary: "Update a product listing" })
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: UpdateProductDto })
    async updateProduct(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
        return this.productService.updateProduct(id, dto);
    }

    @Delete(":id")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN", "USER")
    @ApiOperation({ summary: "Delete a product listing" })
    @ApiParam({ name: "id", type: Number })
    async deleteProduct(@Param("id", ParseIntPipe) id: number) {
        return this.productService.deleteProduct(id);
    }

    @Post(":id/variants")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN", "USER")
    @ApiOperation({ summary: "Create a product variant", description: "Use variants for size/option-specific prices." })
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: CreateVariantDto })
    async createVariant(@Param("id", ParseIntPipe) productId: number, @Body() dto: CreateVariantDto) {
        return this.productService.createVariant(productId, dto);
    }

    @Delete(":id/variants/:variantId")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN", "USER")
    @ApiOperation({ summary: "Delete a product variant" })
    @ApiParam({ name: "id", type: Number })
    @ApiParam({ name: "variantId", type: Number })
    async deleteVariant(
        @Param("id", ParseIntPipe) productId: number,
        @Param("variantId", ParseIntPipe) variantId: number,
    ) {
        return this.productService.deleteVariant(productId, variantId);
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
