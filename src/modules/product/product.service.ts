import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto } from "./dtos/create-product.dto";
import { UpdateProductDto } from "./dtos/update-product.dto";
import { CreateVariantDto } from "./dtos/create-variant.dto";
import { CreateReviewDto } from "./dtos/create-review.dto";
import { ProductQueryDto } from "./dtos/product-query.dto";

@Injectable()
export class ProductService {
    constructor(private readonly prismaService: PrismaService) {}

    private calculateDiscounts(original: number, discounted?: number, percentage?: number) {
        let finalDiscounted = discounted ?? null;
        let finalPercentage = percentage ?? null;

        if (discounted !== undefined && discounted !== null) {
            if (discounted > original) {
                throw new BadRequestException("Discounted price cannot be greater than original price");
            }
            finalPercentage = Math.round(((original - discounted) / original) * 100);
        } else if (percentage !== undefined && percentage !== null) {
            if (percentage < 0 || percentage > 100) {
                throw new BadRequestException("Discount percentage must be between 0 and 100");
            }
            finalDiscounted = Number((original - (original * percentage) / 100).toFixed(2));
        }

        return { discounted_price: finalDiscounted, discount_percentage: finalPercentage };
    }

    async createProduct(dto: CreateProductDto) {
        // Validate category
        const category = await this.prismaService.category.findUnique({
            where: { id: dto.categoryId },
        });
        if (!category) {
            throw new NotFoundException(`Category with ID ${dto.categoryId} not found`);
        }

        // Validate subcategory
        const subCategory = await this.prismaService.subCategory.findFirst({
            where: { id: dto.subCategoryId, categoryId: dto.categoryId },
        });
        if (!subCategory) {
            throw new NotFoundException(`SubCategory with ID ${dto.subCategoryId} not found under Category ${dto.categoryId}`);
        }

        const discountData = this.calculateDiscounts(dto.original_price, dto.discounted_price, dto.discount_percentage);

        return this.prismaService.product.create({
            data: {
                ...dto,
                ...discountData,
            },
            include: {
                category: true,
                subCategory: true,
            },
        });
    }

    async findAllProducts(query: ProductQueryDto) {
        const { page = 1, limit = 10, search, categoryId, subCategoryId, minPrice, maxPrice, status, condition } = query;
        const skip = (page - 1) * limit;

        const whereClause: any = {};

        if (search) {
            whereClause.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
            ];
        }

        if (categoryId) {
            whereClause.categoryId = categoryId;
        }

        if (subCategoryId) {
            whereClause.subCategoryId = subCategoryId;
        }

        if (status) {
            whereClause.status = status;
        }

        if (condition) {
            whereClause.condition = condition;
        }

        if (minPrice !== undefined || maxPrice !== undefined) {
            whereClause.original_price = {};
            if (minPrice !== undefined) {
                whereClause.original_price.gte = minPrice;
            }
            if (maxPrice !== undefined) {
                whereClause.original_price.lte = maxPrice;
            }
        }

        const [data, total] = await Promise.all([
            this.prismaService.product.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: {
                    category: true,
                    subCategory: true,
                    variants: true,
                },
                orderBy: {
                    createdAt: "desc",
                },
            }),
            this.prismaService.product.count({ where: whereClause }),
        ]);

        const pages = Math.ceil(total / limit);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                pages,
            },
        };
    }

    async findProductById(id: number) {
        const product = await this.prismaService.product.findUnique({
            where: { id },
            include: {
                category: true,
                subCategory: true,
                variants: true,
                reviews: true,
            },
        });

        if (!product) {
            throw new NotFoundException(`Product with ID ${id} not found`);
        }

        return product;
    }

    async updateProduct(id: number, dto: UpdateProductDto) {
        const existingProduct = await this.findProductById(id);

        const categoryId = dto.categoryId ?? existingProduct.categoryId;
        const subCategoryId = dto.subCategoryId ?? existingProduct.subCategoryId;

        if (dto.categoryId || dto.subCategoryId) {
            // Check if subcategory belongs to category
            const subCategory = await this.prismaService.subCategory.findFirst({
                where: { id: subCategoryId, categoryId },
            });
            if (!subCategory) {
                throw new NotFoundException(`SubCategory with ID ${subCategoryId} not found under Category ${categoryId}`);
            }
        }

        let discountData = {};
        if (
            dto.original_price !== undefined ||
            dto.discounted_price !== undefined ||
            dto.discount_percentage !== undefined
        ) {
            const orig = dto.original_price ?? existingProduct.original_price;
            const disc = dto.discounted_price !== undefined ? dto.discounted_price : (existingProduct.discounted_price ?? undefined);
            const perc = dto.discount_percentage !== undefined ? dto.discount_percentage : (existingProduct.discount_percentage ?? undefined);

            discountData = this.calculateDiscounts(orig, disc, perc);
        }

        return this.prismaService.product.update({
            where: { id },
            data: {
                ...dto,
                ...discountData,
            },
            include: {
                category: true,
                subCategory: true,
            },
        });
    }

    async deleteProduct(id: number) {
        await this.findProductById(id);

        // Delete variants and reviews first to prevent constraint violations
        await this.prismaService.productVariant.deleteMany({
            where: { productId: id },
        });

        await this.prismaService.productReview.deleteMany({
            where: { productId: id },
        });

        return this.prismaService.product.delete({
            where: { id },
        });
    }

    async createVariant(productId: number, dto: CreateVariantDto) {
        await this.findProductById(productId);

        return this.prismaService.productVariant.create({
            data: {
                ...dto,
                productId,
            },
        });
    }

    async deleteVariant(productId: number, variantId: number) {
        const variant = await this.prismaService.productVariant.findFirst({
            where: { id: variantId, productId },
        });

        if (!variant) {
            throw new NotFoundException(`Variant with ID ${variantId} not found under Product ${productId}`);
        }

        return this.prismaService.productVariant.delete({
            where: { id: variantId },
        });
    }

    async createReview(productId: number, userId: number, dto: CreateReviewDto) {
        await this.findProductById(productId);

        const newReview = await this.prismaService.productReview.create({
            data: {
                ...dto,
                productId,
                userId,
            },
        });

        // Recalculate average rating & total reviews
        const aggregates = await this.prismaService.productReview.aggregate({
            where: { productId },
            _count: { id: true },
            _avg: { rating: true },
        });

        await this.prismaService.product.update({
            where: { id: productId },
            data: {
                total_reviews: aggregates._count.id,
                average_rating: aggregates._avg.rating ?? 0,
            },
        });

        return newReview;
    }

    async findReviews(productId: number) {
        await this.findProductById(productId);

        return this.prismaService.productReview.findMany({
            where: { productId },
            orderBy: {
                createdAt: "desc",
            },
        });
    }
}
