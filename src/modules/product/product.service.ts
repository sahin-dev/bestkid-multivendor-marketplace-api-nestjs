import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto, ProductVariantInputDto } from "./dtos/create-product.dto";
import { UpdateProductDto } from "./dtos/update-product.dto";
import { CreateVariantDto } from "./dtos/create-variant.dto";
import { CreateReviewDto } from "./dtos/create-review.dto";
import { ProductQueryDto, ProductSort } from "./dtos/product-query.dto";
import { AuthenticationStatus, OrderStatus, ProductStatus } from "generated/prisma/client";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { AdminProductApprovalFilter, AdminProductQueryDto } from "./dtos/admin-product-query.dto";

@Injectable()
export class ProductService {
    constructor(private readonly prismaService: PrismaService) { }

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

    async createProduct(userId: number, dto: CreateProductDto) {
        await this.assertSellerCanCreateProduct(userId, dto.status);

        await this.validateCategoryPair(dto.categoryId, dto.subCategoryId);

        const discountData = this.calculateDiscounts(dto.original_price, dto.discounted_price, dto.discount_percentage);
        const effectivePrice = discountData.discounted_price ?? dto.original_price;
        const variantInputs = this.normalizeVariantInputs(dto.variants, dto.variant_names, effectivePrice);
        const { variants, variant_names, ...productData } = dto;

        return this.prismaService.product.create({
            data: {
                ...productData,
                ...discountData,
                image_urls: dto.image_urls ?? [],
                userId,
                ...(variantInputs.length
                    ? {
                          variants: {
                              create: variantInputs,
                          },
                      }
                    : {}),
            },
            include: {
                category: true,
                subCategory: true,
                variants: true,
            },
        });
    }

    async findSellerProducts(sellerId: number, query: ProductQueryDto) {
        const { page = 1, limit = 10, search, status = ProductStatus.ACTIVE, sort = ProductSort.LATEST } = query;
        const skip = (page - 1) * limit;
        const whereClause: any = { userId: sellerId, status };

        if (search) {
            whereClause.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
            ];
        }

        const [data, total] = await Promise.all([
            this.prismaService.product.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: this.getProductOrderBy(sort),
                include: {
                    category: true,
                    subCategory: true,
                    variants: true,
                },
            }),
            this.prismaService.product.count({ where: whereClause }),
        ]);

        return {
            data: data.map((product) => this.formatSellerProductCard(product)),
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async findSellerProductById(productId: number, sellerId: number, isAdmin = false) {
        const product = await this.getProductForMutation(productId);
        this.assertCanMutateProduct(product, sellerId, isAdmin);

        const [reviews, ordersCount] = await Promise.all([
            this.findReviews(productId, { page: 1, limit: 5 }),
            this.prismaService.order.count({
                where: {
                    sellerId: product.userId,
                    items: { some: { productId } },
                },
            }),
        ]);

        return {
            ...this.formatSellerProductDetail(product),
            reviews: reviews.data,
            orders_count: ordersCount,
            actions: {
                can_update: true,
                can_view_orders: true,
                can_mark_active: product.status !== ProductStatus.ACTIVE,
                can_mark_inactive: product.status === ProductStatus.ACTIVE,
                can_delete: true,
            },
        };
    }

    async updateSellerProductStatus(productId: number, sellerId: number, status: ProductStatus, isAdmin = false) {
        const product = await this.getProductForMutation(productId);
        this.assertCanMutateProduct(product, sellerId, isAdmin);

        if (status === ProductStatus.ACTIVE) {
            await this.assertCanPublishProduct(product.userId);
        }

        const updated = await this.prismaService.product.update({
            where: { id: productId },
            data: { status },
            include: this.getSellerProductInclude(),
        });

        return this.formatSellerProductDetail(updated);
    }

    async findAllProducts(query: ProductQueryDto, userId?: number) {
        const {
            page = 1,
            limit = 10,
            search,
            categoryId,
            subCategoryId,
            sellerId,
            minPrice,
            maxPrice,
            condition,
            sort = ProductSort.LATEST,
            minRating,
            discountedOnly,
            size,
        } = query;
        const skip = (page - 1) * limit;

        const whereClause: any = {};
        const andFilters: any[] = [];

        if (search) {
            andFilters.push({
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { description: { contains: search, mode: "insensitive" } },
                ],
            });
        }

        if (categoryId) {
            whereClause.categoryId = categoryId;
        }

        if (subCategoryId) {
            whereClause.subCategoryId = subCategoryId;
        }

        if (sellerId) {
            whereClause.userId = sellerId;
        }

        whereClause.status = "ACTIVE";

        if (condition) {
            whereClause.condition = condition;
        }

        if (minRating !== undefined) {
            whereClause.average_rating = { gte: minRating };
        }

        if (discountedOnly) {
            whereClause.discounted_price = { not: null };
        }

        if (size) {
            whereClause.variants = {
                some: { variantName: { contains: size, mode: "insensitive" } },
            };
        }

        if (minPrice !== undefined || maxPrice !== undefined) {
            const discountedPrice: any = { not: null };
            const originalPrice: any = {};
            if (minPrice !== undefined) {
                discountedPrice.gte = minPrice;
                originalPrice.gte = minPrice;
            }
            if (maxPrice !== undefined) {
                discountedPrice.lte = maxPrice;
                originalPrice.lte = maxPrice;
            }

            andFilters.push({
                OR: [
                    { discounted_price: discountedPrice },
                    { discounted_price: null, original_price: originalPrice },
                ],
            });
        }

        if (andFilters.length > 0) {
            whereClause.AND = andFilters;
        }

        const orderBy = this.getProductOrderBy(sort);

        const [data, total] = await Promise.all([
            this.prismaService.product.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: {
                        category: true,
                        subCategory: true,
                        variants: true,
                        user: {
                            select: {
                                id: true,
                                profile: { select: { full_name: true, avatar_url: true, country: true } },
                            },
                        },
                    },
                orderBy,
            }),
            this.prismaService.product.count({ where: whereClause }),
        ]);

        const pages = Math.ceil(total / limit);
        const wishlistedIds = await this.getWishlistedProductIds(userId, data.map((product) => product.id));

        return {
            data: this.withWishlistState(data, wishlistedIds),
            meta: {
                total,
                page,
                limit,
                pages,
            },
        };
    }

    async findProductById(id: number, userId?: number) {
        const product = await this.prismaService.product.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        seller_tier: true,
                        stripe_onboarding_complete: true,
                        profile: { select: { full_name: true, avatar_url: true, country: true } },
                        delivery_option: true,
                    },
                },
                category: true,
                subCategory: true,
                variants: true,
                reviews: {
                    orderBy: { createdAt: "desc" },
                    take: 5,
                    include: {
                        user: {
                            select: {
                                id: true,
                                profile: { select: { full_name: true, avatar_url: true } },
                            },
                        },
                    },
                },
            },
        });

        if (!product) {
            throw new NotFoundException(`Product with ID ${id} not found`);
        }

        // Track view — fire-and-forget (don't await to keep response fast)
        this.prismaService.product.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => {});

        // Track recently viewed for logged-in users
        if (userId) {
            this.prismaService.recentlyView
                .upsert({
                    where: { userId_productId: { userId, productId: id } },
                    update: { viewedAt: new Date() },
                    create: { userId, productId: id },
                })
                .catch(() => {});
        }

        const [isWishlisted, sellerStats, relatedProducts] = await Promise.all([
            this.isProductWishlisted(userId, id),
            this.getSellerStats(product.userId),
            this.findRelatedProducts(id, product.categoryId, userId),
        ]);

        return {
            ...product,
            effective_price: product.discounted_price ?? product.original_price,
            is_wishlisted: isWishlisted,
            seller_overview: sellerStats,
            related_products: relatedProducts,
        };
    }

    async updateProduct(id: number, dto: UpdateProductDto, actorId?: number, isAdmin = false) {
        const existingProduct = await this.getProductForMutation(id);
        if (actorId !== undefined) {
            this.assertCanMutateProduct(existingProduct, actorId, isAdmin);
        }

        const categoryId = dto.categoryId ?? existingProduct.categoryId;
        const subCategoryId = dto.subCategoryId ?? existingProduct.subCategoryId;

        if (dto.categoryId || dto.subCategoryId) {
            await this.validateCategoryPair(categoryId, subCategoryId);
        }

        if (dto.status === ProductStatus.ACTIVE) {
            await this.assertCanPublishProduct(existingProduct.userId);
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

        const finalPrice =
            (discountData as { discounted_price?: number | null }).discounted_price ??
            dto.discounted_price ??
            existingProduct.discounted_price ??
            dto.original_price ??
            existingProduct.original_price;
        const variantInputs = this.normalizeVariantInputs(dto.variants, dto.variant_names, finalPrice);
        const { variants, variant_names, replace_variants, ...productData } = dto;

        return this.prismaService.$transaction(async (tx) => {
            if (variantInputs.length > 0) {
                const shouldReplace = replace_variants !== false;
                if (shouldReplace) {
                    await tx.productVariant.deleteMany({
                        where: {
                            productId: id,
                            order_items: { none: {} },
                            cart_listed: { none: {} },
                        },
                    });
                }

                await tx.productVariant.createMany({
                    data: variantInputs.map((variant) => ({ ...variant, productId: id })),
                });
            }

            return tx.product.update({
                where: { id },
                data: {
                    ...productData,
                    ...discountData,
                },
                include: this.getSellerProductInclude(),
            });
        });
    }

    async deleteProduct(id: number, actorId?: number, isAdmin = false) {
        const product = await this.getProductForMutation(id);
        if (actorId !== undefined) {
            this.assertCanMutateProduct(product, actorId, isAdmin);
        }

        const orderItemCount = await this.prismaService.orderItem.count({ where: { productId: id } });
        if (orderItemCount > 0) {
            throw new BadRequestException("Product cannot be deleted after it has been ordered. Mark it inactive instead.");
        }

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

    async createVariant(productId: number, dto: CreateVariantDto, actorId?: number, isAdmin = false) {
        const product = await this.getProductForMutation(productId);
        if (actorId !== undefined) {
            this.assertCanMutateProduct(product, actorId, isAdmin);
        }

        return this.prismaService.productVariant.create({
            data: {
                ...dto,
                productId,
            },
        });
    }

    async deleteVariant(productId: number, variantId: number, actorId?: number, isAdmin = false) {
        const product = await this.getProductForMutation(productId);
        if (actorId !== undefined) {
            this.assertCanMutateProduct(product, actorId, isAdmin);
        }

        const variant = await this.prismaService.productVariant.findFirst({
            where: { id: variantId, productId },
        });

        if (!variant) {
            throw new NotFoundException(`Variant with ID ${variantId} not found under Product ${productId}`);
        }

        const orderItemCount = await this.prismaService.orderItem.count({ where: { variantId } });
        if (orderItemCount > 0) {
            throw new BadRequestException("Variant cannot be deleted after it has been ordered.");
        }

        return this.prismaService.productVariant.delete({ where: { id: variantId } });
    }

    async createReview(productId: number, userId: number, dto: CreateReviewDto) {
        await this.findProductById(productId);
        this.assertReviewTextWithinWordLimit(dto.review);

        const deliveredOrderItem = await this.prismaService.orderItem.findFirst({
            where: {
                productId,
                order: {
                    userId,
                    status: OrderStatus.DELIVERED,
                },
                review: null,
            },
            orderBy: { createdAt: "desc" },
        });

        if (!deliveredOrderItem) {
            throw new BadRequestException("You can review this product only after purchasing and receiving it");
        }

        const newReview = await this.prismaService.productReview.create({
            data: {
                ...dto,
                productId,
                orderItemId: deliveredOrderItem.id,
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

    async findReviews(productId: number, query: PaginationDto = { page: 1, limit: 10 }) {
        await this.findProductById(productId);

        const { page = 1, limit = 10 } = query ?? {};
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.prismaService.productReview.findMany({
                where: { productId },
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            profile: { select: { full_name: true, avatar_url: true } },
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
            }),
            this.prismaService.productReview.count({ where: { productId } }),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async findAllProductsAdmin(query: AdminProductQueryDto) {
        const {
            page = 1,
            limit = 10,
            search,
            categoryId,
            subCategoryId,
            status,
            sellerId,
            authenticationStatus,
            approval,
        } = query;
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

        if (sellerId) {
            whereClause.userId = sellerId;
        }

        if (authenticationStatus) {
            whereClause.authentication_status = authenticationStatus;
        }

        if (approval && approval !== AdminProductApprovalFilter.ALL) {
            const approvalMap: Record<Exclude<AdminProductApprovalFilter, AdminProductApprovalFilter.ALL>, AuthenticationStatus> = {
                [AdminProductApprovalFilter.APPROVED]: AuthenticationStatus.VERIFIED,
                [AdminProductApprovalFilter.REJECTED]: AuthenticationStatus.NOT_VERIFIED,
                [AdminProductApprovalFilter.PENDING]: AuthenticationStatus.PENDING,
            };

            whereClause.authentication_status = approvalMap[approval];
        }

        const [data, total] = await Promise.all([
            this.prismaService.product.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    category: true,
                    subCategory: true,
                    user: {
                        select: {
                            id: true,
                            email: true,
                            profile: { select: { full_name: true } },
                        },
                    },
                },
            }),
            this.prismaService.product.count({ where: whereClause }),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async updateProductAuthStatusAdmin(id: number, status: AuthenticationStatus) {
        const product = await this.prismaService.product.findUnique({ where: { id } });
        if (!product) {
            throw new NotFoundException(`Product with ID ${id} not found`);
        }

        const isAuthenticated = status === AuthenticationStatus.VERIFIED;
        const now = new Date();

        return this.prismaService.product.update({
            where: { id },
            data: {
                authentication_status: status,
                is_authenticated: isAuthenticated,
                approved_at:
                    status === AuthenticationStatus.VERIFIED
                        ? now
                        : status === AuthenticationStatus.PENDING
                          ? null
                          : product.approved_at,
                rejected_at:
                    status === AuthenticationStatus.NOT_VERIFIED
                        ? now
                        : status === AuthenticationStatus.PENDING
                          ? null
                          : product.rejected_at,
            },
            include: {
                category: true,
                subCategory: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        profile: { select: { full_name: true } },
                    },
                },
            },
        });
    }

    private getProductOrderBy(sort: ProductSort) {
        switch (sort) {
            case ProductSort.PRICE_LOW:
                return [{ original_price: "asc" as const }];
            case ProductSort.PRICE_HIGH:
                return [{ original_price: "desc" as const }];
            case ProductSort.RATING:
                return [{ average_rating: "desc" as const }, { total_reviews: "desc" as const }];
            case ProductSort.POPULAR:
                return [{ views: "desc" as const }, { average_rating: "desc" as const }];
            case ProductSort.LATEST:
            default:
                return [{ createdAt: "desc" as const }];
        }
    }

    private async getWishlistedProductIds(userId: number | undefined, productIds: number[]) {
        if (!userId || productIds.length === 0) {
            return new Set<number>();
        }

        const items = await this.prismaService.wishlistItem.findMany({
            where: { userId, productId: { in: [...new Set(productIds)] } },
            select: { productId: true },
        });

        return new Set(items.map((item) => item.productId));
    }

    private withWishlistState<T extends { id: number; original_price: number; discounted_price?: number | null }>(
        products: T[],
        wishlistedIds: Set<number>,
    ) {
        return products.map((product) => ({
            ...product,
            effective_price: product.discounted_price ?? product.original_price,
            is_wishlisted: wishlistedIds.has(product.id),
        }));
    }

    private async isProductWishlisted(userId: number | undefined, productId: number) {
        if (!userId) {
            return false;
        }

        const item = await this.prismaService.wishlistItem.findUnique({
            where: { userId_productId: { userId, productId } },
            select: { id: true },
        });

        return Boolean(item);
    }

    private async getSellerStats(sellerId: number) {
        const [productCount, orderItemCount, ratingAggregate] = await Promise.all([
            this.prismaService.product.count({ where: { userId: sellerId, status: "ACTIVE" } }),
            this.prismaService.orderItem.count({
                where: {
                    order: {
                        sellerId,
                        status: {
                            in: [
                                OrderStatus.CONFIRMED,
                                OrderStatus.PROCESSING,
                                OrderStatus.SHIPPED,
                                OrderStatus.DELIVERED,
                            ],
                        },
                    },
                },
            }),
            this.prismaService.product.aggregate({
                where: { userId: sellerId, total_reviews: { gt: 0 } },
                _avg: { average_rating: true },
                _sum: { total_reviews: true },
            }),
        ]);

        return {
            active_products: productCount,
            items_sold: orderItemCount,
            average_rating: ratingAggregate._avg.average_rating ?? 0,
            total_reviews: ratingAggregate._sum.total_reviews ?? 0,
        };
    }

    private async findRelatedProducts(productId: number, categoryId: number, userId?: number) {
        const products = await this.prismaService.product.findMany({
            where: {
                id: { not: productId },
                categoryId,
                status: "ACTIVE",
            },
            take: 4,
            orderBy: [{ average_rating: "desc" }, { createdAt: "desc" }],
            include: {
                category: true,
                subCategory: true,
                variants: true,
            },
        });

        const wishlistedIds = await this.getWishlistedProductIds(userId, products.map((product) => product.id));
        return this.withWishlistState(products, wishlistedIds);
    }

    private assertReviewTextWithinWordLimit(review?: string) {
        if (!review) {
            return;
        }

        const wordCount = review.trim().split(/\s+/).filter(Boolean).length;
        if (wordCount > 100) {
            throw new BadRequestException("Review cannot be longer than 100 words");
        }
    }

    private async validateCategoryPair(categoryId: number, subCategoryId: number) {
        const category = await this.prismaService.category.findUnique({ where: { id: categoryId } });
        if (!category) {
            throw new NotFoundException(`Category with ID ${categoryId} not found`);
        }

        const subCategory = await this.prismaService.subCategory.findFirst({
            where: { id: subCategoryId, categoryId },
        });
        if (!subCategory) {
            throw new NotFoundException(`SubCategory with ID ${subCategoryId} not found under Category ${categoryId}`);
        }
    }

    private async assertSellerCanCreateProduct(sellerId: number, requestedStatus?: ProductStatus) {
        const readiness = await this.getSellerProductReadiness(sellerId);
        if (!readiness.stripe_connected) {
            throw new ForbiddenException({
                code: "STRIPE_ACCOUNT_REQUIRED",
                message: "You must complete Stripe onboarding before listing products.",
                readiness,
            });
        }

        if ((requestedStatus ?? ProductStatus.INACTIVE) === ProductStatus.ACTIVE && !readiness.delivery_configured) {
            throw new ForbiddenException({
                code: "DELIVERY_INFORMATION_MISSING",
                message: "Complete delivery settings before making products available for purchase.",
                readiness,
            });
        }
    }

    private async assertCanPublishProduct(sellerId: number) {
        const readiness = await this.getSellerProductReadiness(sellerId);
        if (!readiness.stripe_connected) {
            throw new ForbiddenException({
                code: "STRIPE_ACCOUNT_REQUIRED",
                message: "Connect your Stripe account before publishing products.",
                readiness,
            });
        }
        if (!readiness.delivery_configured) {
            throw new ForbiddenException({
                code: "DELIVERY_INFORMATION_MISSING",
                message: "Complete delivery settings before publishing products.",
                readiness,
            });
        }
    }

    async getSellerProductReadiness(sellerId: number) {
        const seller = await this.prismaService.baseUser.findUnique({
            where: { id: sellerId },
            select: {
                id: true,
                stripe_account_id: true,
                stripe_onboarding_complete: true,
                delivery_option: true,
            },
        });

        if (!seller) {
            throw new NotFoundException(`Seller with ID ${sellerId} not found`);
        }

        const deliveryConfigured = this.isDeliveryConfigured(seller.delivery_option);
        const blockers = [
            ...(seller.stripe_onboarding_complete ? [] : ["STRIPE_ACCOUNT_REQUIRED"]),
            ...(deliveryConfigured ? [] : ["DELIVERY_INFORMATION_MISSING"]),
        ];

        return {
            stripe_connected: seller.stripe_onboarding_complete,
            stripe_account_id: seller.stripe_account_id,
            delivery_configured: deliveryConfigured,
            can_create_product: seller.stripe_onboarding_complete,
            can_publish_product: seller.stripe_onboarding_complete && deliveryConfigured,
            blockers,
        };
    }

    private isDeliveryConfigured(deliveryOption: any) {
        if (!deliveryOption) {
            return false;
        }

        const hasDomestic =
            Boolean(deliveryOption.domestic_partner) &&
            deliveryOption.domestic_cost !== null &&
            deliveryOption.domestic_days_min !== null &&
            deliveryOption.domestic_days_max !== null;
        const hasInternational =
            Boolean(deliveryOption.international_partner) &&
            deliveryOption.international_cost !== null &&
            deliveryOption.international_days_min !== null &&
            deliveryOption.international_days_max !== null;

        return hasDomestic || hasInternational;
    }

    private async getProductForMutation(id: number) {
        const product = await this.prismaService.product.findUnique({
            where: { id },
            include: this.getSellerProductInclude(),
        });
        if (!product) {
            throw new NotFoundException(`Product with ID ${id} not found`);
        }
        return product;
    }

    private getSellerProductInclude() {
        return {
            category: true,
            subCategory: true,
            variants: true,
            user: {
                select: {
                    id: true,
                    email: true,
                    seller_tier: true,
                    stripe_onboarding_complete: true,
                    profile: { select: { full_name: true, avatar_url: true, country: true } },
                },
            },
        };
    }

    private assertCanMutateProduct(product: { userId: number }, actorId: number, isAdmin = false) {
        if (!isAdmin && product.userId !== actorId) {
            throw new ForbiddenException("You do not have permission to modify this product");
        }
    }

    private normalizeVariantInputs(
        variants: ProductVariantInputDto[] | undefined,
        variantNames: string[] | undefined,
        fallbackPrice: number,
    ) {
        const inputs: ProductVariantInputDto[] = [
            ...(variants ?? []),
            ...(variantNames ?? []).map((variantName) => ({ variantName })),
        ];
        const seen = new Set<string>();
        const normalized: { variantName: string; price: number }[] = [];

        for (const input of inputs) {
            const variantName = input.variantName?.trim();
            if (!variantName) {
                continue;
            }
            const key = variantName.toLowerCase();
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            normalized.push({
                variantName,
                price: input.price ?? fallbackPrice,
            });
        }

        return normalized;
    }

    private formatSellerProductCard(product: any) {
        return {
            id: product.id,
            name: product.name,
            status: product.status,
            category: product.category,
            subCategory: product.subCategory,
            image_urls: product.image_urls,
            image_url: product.image_urls?.[0] ?? null,
            original_price: product.original_price,
            discounted_price: product.discounted_price,
            effective_price: product.discounted_price ?? product.original_price,
            discount_percentage: product.discount_percentage,
            average_rating: product.average_rating ?? 0,
            total_reviews: product.total_reviews,
            variants: product.variants,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
            actions: {
                can_view_details: true,
                can_update: true,
                can_mark_active: product.status !== ProductStatus.ACTIVE,
                can_mark_inactive: product.status === ProductStatus.ACTIVE,
                can_delete: true,
            },
        };
    }

    private formatSellerProductDetail(product: any) {
        return {
            ...this.formatSellerProductCard(product),
            description: product.description,
            condition: product.condition,
            is_authenticated: product.is_authenticated,
            authentication_status: product.authentication_status,
            approved_at: product.approved_at,
            rejected_at: product.rejected_at,
            seller: product.user,
        };
    }
}
