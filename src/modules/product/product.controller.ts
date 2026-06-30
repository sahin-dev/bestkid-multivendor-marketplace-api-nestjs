import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { GetUser, Public, Roles } from "src/common/decorators";
import { ProductService } from "./product.service";
import { CreateProductDto } from "./dtos/create-product.dto";
import { UpdateProductDto } from "./dtos/update-product.dto";
import { CreateVariantDto } from "./dtos/create-variant.dto";
import { CreateReviewDto } from "./dtos/create-review.dto";
import { ProductQueryDto } from "./dtos/product-query.dto";
import { UpdateProductAuthStatusDto } from "./dtos/update-product-auth-status.dto";

@ApiTags("Products")
@Controller("products")
export class ProductController {
    constructor(private readonly productService: ProductService) {}

    @Post()
    @ApiBearerAuth("access-token")
    @Roles("ADMIN", "SELLER")
    @ApiBody({ type: CreateProductDto })
    async createProduct(@GetUser("id") userId: number, @Body() dto: CreateProductDto) {
        return this.productService.createProduct(userId, dto);
    }

    @Get()
    @Public()
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    @ApiQuery({ name: "categoryId", required: false, type: Number })
    @ApiQuery({ name: "sellerId", required: false, type: Number })
    @ApiQuery({ name: "search", required: false, type: String })
    async findAllProducts(@Query() query: ProductQueryDto) {
        return this.productService.findAllProducts(query);
    }

    @Get(":id")
    @Public()
    @ApiParam({ name: "id", type: Number })
    async findProductById(@Param("id", ParseIntPipe) id: number, @Req() req: Request) {
        const user = req["user"] as { id: number } | undefined;
        return this.productService.findProductById(id, user?.id);
    }

    @Patch(":id")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN", "SELLER")
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: UpdateProductDto })
    async updateProduct(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
        return this.productService.updateProduct(id, dto);
    }

    @Delete(":id")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN", "SELLER")
    @ApiParam({ name: "id", type: Number })
    async deleteProduct(@Param("id", ParseIntPipe) id: number) {
        return this.productService.deleteProduct(id);
    }

    @Post(":id/variants")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN", "SELLER")
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: CreateVariantDto })
    async createVariant(@Param("id", ParseIntPipe) productId: number, @Body() dto: CreateVariantDto) {
        return this.productService.createVariant(productId, dto);
    }

    @Delete(":id/variants/:variantId")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN", "SELLER")
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
    @ApiParam({ name: "id", type: Number })
    async findReviews(@Param("id", ParseIntPipe) productId: number) {
        return this.productService.findReviews(productId);
    }

    @Get("admin/all")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    @ApiQuery({ name: "categoryId", required: false, type: Number })
    @ApiQuery({ name: "sellerId", required: false, type: Number })
    @ApiQuery({ name: "search", required: false, type: String })
    async findAllProductsAdmin(@Query() query: ProductQueryDto) {
        return this.productService.findAllProductsAdmin(query);
    }

    @Patch("admin/:id/auth-status")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: UpdateProductAuthStatusDto })
    async updateProductAuthStatusAdmin(
        @Param("id", ParseIntPipe) productId: number,
        @Body() dto: UpdateProductAuthStatusDto,
    ) {
        return this.productService.updateProductAuthStatusAdmin(productId, dto.status);
    }
}
