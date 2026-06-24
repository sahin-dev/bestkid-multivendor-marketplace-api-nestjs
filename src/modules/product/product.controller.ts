import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { GetUser, Public, Roles } from "src/common/decorators";
import { ProductService } from "./product.service";
import { CreateProductDto } from "./dtos/create-product.dto";
import { UpdateProductDto } from "./dtos/update-product.dto";
import { CreateVariantDto } from "./dtos/create-variant.dto";
import { CreateReviewDto } from "./dtos/create-review.dto";
import { ProductQueryDto } from "./dtos/product-query.dto";

@ApiTags("Products")
@Controller("products")
export class ProductController {
    constructor(private readonly productService: ProductService) {}

    @Post()
    @ApiBearerAuth("access-token")
    @Roles("ADMIN", "SELLER")
    async createProduct(@Body() dto: CreateProductDto) {
        return this.productService.createProduct(dto);
    }

    @Get()
    @Public()
    async findAllProducts(@Query() query: ProductQueryDto) {
        return this.productService.findAllProducts(query);
    }

    @Get(":id")
    @Public()
    async findProductById(@Param("id", ParseIntPipe) id: number) {
        return this.productService.findProductById(id);
    }

    @Patch(":id")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN", "SELLER")
    async updateProduct(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
        return this.productService.updateProduct(id, dto);
    }

    @Delete(":id")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN", "SELLER")
    async deleteProduct(@Param("id", ParseIntPipe) id: number) {
        return this.productService.deleteProduct(id);
    }

    @Post(":id/variants")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN", "SELLER")
    async createVariant(@Param("id", ParseIntPipe) productId: number, @Body() dto: CreateVariantDto) {
        return this.productService.createVariant(productId, dto);
    }

    @Delete(":id/variants/:variantId")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN", "SELLER")
    async deleteVariant(
        @Param("id", ParseIntPipe) productId: number,
        @Param("variantId", ParseIntPipe) variantId: number,
    ) {
        return this.productService.deleteVariant(productId, variantId);
    }

    @Post(":id/reviews")
    @ApiBearerAuth("access-token")
    async createReview(
        @Param("id", ParseIntPipe) productId: number,
        @GetUser("id") userId: number,
        @Body() dto: CreateReviewDto,
    ) {
        return this.productService.createReview(productId, userId, dto);
    }

    @Get(":id/reviews")
    @Public()
    async findReviews(@Param("id", ParseIntPipe) productId: number) {
        return this.productService.findReviews(productId);
    }
}
