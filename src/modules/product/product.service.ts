import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto } from "./dtos/create-product.dto";
import { UpdateProductDto } from "./dtos/update-product.dto";
import { CreateReviewDto } from "./dtos/create-review.dto";
import { ProductQueryDto, ProductSort, SellerProductStatus } from "./dtos/product-query.dto";
import { AuthenticationStatus, NotificationType, OrderStatus, ProductStatus, Prisma } from "generated/prisma/client";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { AdminProductApprovalFilter, AdminProductQueryDto } from "./dtos/admin-product-query.dto";
import { assertEntityExists } from "src/common/validators/entity-exists.validator";
import { NotificationService } from "../notification/notification.service";
import { CurrencyConversionService } from "../currency/currency.service";
import { CurrencyPreference } from "generated/prisma/client";

@Injectable()
export class ProductService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly notificationService: NotificationService,
        private readonly currencyService: CurrencyConversionService,
    ) { }

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

        return this.prismaService.product.create({
            data: {
                ...dto,
                ...discountData,
                image_urls: dto.image_urls ?? [],
                userId,
            },
            include: {
                category: true,
                subCategory: true,
            },
        });
    }

    async findSellerProducts(sellerId: number, query: ProductQueryDto) {
        const {
            page = 1,
            limit = 10,
            search,
            sort = ProductSort.LATEST,
            sellerStatus,
            authenticationStatus,
            status = ProductStatus.ACTIVE,
        } = query;


        const skip = (page - 1) * limit;
        const whereClause: any = { userId: sellerId };
        let requiresManualFilter = false;

        if (search) {
            whereClause.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
            ];
        }

        if (sellerStatus) {
            switch (sellerStatus) {
                case SellerProductStatus.LIVE:
                    whereClause.status = ProductStatus.ACTIVE;
                    whereClause.authentication_status = AuthenticationStatus.VERIFIED;
                    break;
                case SellerProductStatus.SOLD:
                    whereClause.status = ProductStatus.SOLD;
                    break;
                case SellerProductStatus.REJECTED:
                    whereClause.authentication_status = AuthenticationStatus.NOT_VERIFIED;
                    break;
                case SellerProductStatus.UNDER_REVIEW:
                case SellerProductStatus.ACTION_REQUIRED:
                    whereClause.status = ProductStatus.INACTIVE;
                    whereClause.authentication_status = AuthenticationStatus.PENDING;
                    requiresManualFilter = true;
                    break;
                case SellerProductStatus.INACTIVE:
                    whereClause.status = ProductStatus.INACTIVE;
                    requiresManualFilter = true;
                    break;
                default:
                    whereClause.status = status;
            }
        } else {
            whereClause.status = status;
        }

        if (authenticationStatus) {
            whereClause.authentication_status = authenticationStatus;
            whereClause.status = ProductStatus.INACTIVE
        }
        console.log(whereClause)
        const products = await this.prismaService.product.findMany({
            where: whereClause,
            orderBy: this.getProductOrderBy(sort),
            include: {
                category: true,
                subCategory: true,
                authentication_requests: {
                    orderBy: [{ createdAt: Prisma.SortOrder.desc }],
                    take: 1,
                },
            },
            ...(requiresManualFilter ? {} : { skip, take: limit }),
        });

        let filteredProducts = products;
        if (requiresManualFilter) {
            filteredProducts = products.filter((product) => this.deriveSellerProductStatus(product) === sellerStatus);
        }

        const total = requiresManualFilter ? filteredProducts.length : await this.prismaService.product.count({ where: whereClause });
        const data = requiresManualFilter ? filteredProducts.slice(skip, skip + limit) : filteredProducts;

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
        try{
            const [reviews, ordersCount] = await Promise.all([
            this.findReviews(productId,{ page: 1, limit: 5 },sellerId ),
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
            latest_request: product.authentication_requests?.[0] ?? null,
            actions: {
                can_update: true,
                can_view_orders: true,
                can_mark_active: product.status !== ProductStatus.ACTIVE,
                can_mark_inactive: product.status === ProductStatus.ACTIVE,
                can_delete: true,
            },
        };
        }catch(err){
            console.log(err)
        }
        

       
    }

    async updateSellerProductStatus(productId: number, sellerId: number, status: ProductStatus, isAdmin = false) {
        const product = await this.getProductForMutation(productId);
        this.assertCanMutateProduct(product, sellerId, isAdmin);

        if (status === ProductStatus.ACTIVE) {
            await this.assertCanPublishProduct(product.userId, product.authentication_status);
        }

        const updated = await this.prismaService.product.update({
            where: { id: productId },
            data: { status },
            include: this.getSellerProductInclude(),
        });

        return this.formatSellerProductDetail(updated);
    }

    async findAllProducts(query: ProductQueryDto, userId?: number) {
        const userCurrency = userId ? await this.getUserCurrency(userId) : CurrencyPreference.USD;
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
        this.requireSellerPaymentSetup(whereClause);
        this.excludeViewerProducts(whereClause, userId);

        const orderBy = this.getProductOrderBy(sort);

        const [data, total] = await Promise.all([
            this.prismaService.product.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: {
                        category: true,
                        subCategory: true,
                        user: {
                            select: {
                                id: true,
                                profile: { select: { full_name: true, avatar_url: true, country: true } },
                            },
                        },
                        authentication_requests: {
                            orderBy: [{ createdAt: Prisma.SortOrder.desc }],
                            take: 1,
                        },
                    },
                orderBy,
            }),
            this.prismaService.product.count({ where: whereClause }),
        ]);

        const pages = Math.ceil(total / limit);
        const wishlistedIds = await this.getWishlistedProductIds(userId, data.map((product) => product.id));
        const items = this.withWishlistState(data, wishlistedIds);

        const convertedItems = await Promise.all(
            items.map(async (product) => {
                const merged = this.mergeProductImageUrls(product);
                return this.applyUserCurrency(merged, userCurrency);
            }),
        );

        return {
            data: convertedItems,
            meta: {
                total,
                page,
                limit,
                pages,
            },
        };
    }

    async findProductById(id: number, userId?: number, isAdmin = false) {

        const userCurrency = userId ? await this.getUserCurrency(userId) : CurrencyPreference.USD;
       
        const product = await this.prismaService.product.findUnique({
            where: { id },
            include: {
                user: {
                    
                },
                category: true,
                subCategory: true,
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
                authentication_requests: {
                    orderBy: [{ createdAt: Prisma.SortOrder.desc }],
                    take: 1,
                },
            },
        });

        
       
        if (!product) {
           
            throw new NotFoundException(`Product with ID ${id} not found`);
        }

        const isOwner = userId !== undefined && product.userId === userId;
        if (product.status !== ProductStatus.ACTIVE && !isOwner && !isAdmin) {
            throw new NotFoundException(`Product with ID ${id} not found`);
        }
        if (!isOwner && !isAdmin && !this.hasSellerPaymentSetup(product.user)) {
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

        const convertedProduct = await this.applyUserCurrency(this.mergeProductImageUrls(product), userCurrency);
        const convertedRelatedProducts = await Promise.all(
            relatedProducts.map(async (item) => this.applyUserCurrency(this.mergeProductImageUrls(item), userCurrency)),
        );

        return {
            ...convertedProduct,
            is_wishlisted: isWishlisted,
            seller_overview: sellerStats,
            related_products: convertedRelatedProducts,
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
            await this.assertCanPublishProduct(existingProduct.userId, existingProduct.authentication_status);
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
            include: this.getSellerProductInclude(),
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

        await this.prismaService.productReview.deleteMany({
            where: { productId: id },
        });

        return this.prismaService.product.delete({
            where: { id },
        });
    }

    async createReview(productId: number, userId: number, dto: CreateReviewDto) {
        await assertEntityExists(this.prismaService.baseUser, "User", userId);
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

    async findReviews(productId: number, query: PaginationDto = { page: 1, limit: 10 },sellerId?:number) {
        await this.findProductById(productId, sellerId);

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
            if (approval === AdminProductApprovalFilter.PENDING) {
                whereClause.authentication_status = {
                    in: [AuthenticationStatus.NOT_SUBMITTED, AuthenticationStatus.PENDING],
                };
            } else {
                const approvalMap: Record<
                    Exclude<AdminProductApprovalFilter, AdminProductApprovalFilter.ALL | AdminProductApprovalFilter.PENDING>,
                    AuthenticationStatus
                > = {
                    [AdminProductApprovalFilter.APPROVED]: AuthenticationStatus.VERIFIED,
                    [AdminProductApprovalFilter.REJECTED]: AuthenticationStatus.NOT_VERIFIED,
                };

                whereClause.authentication_status = approvalMap[approval];
            }
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

    async findProductByIdAdmin(id: number) {
        const product = await this.prismaService.product.findUnique({
            where: { id },
            include: {
                category: true,
                subCategory: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        seller_tier: true,
                        stripe_account_id: true,
                        stripe_onboarding_complete: true,
                        profile: { select: { full_name: true, avatar_url: true, phone: true, country: true } },
                        delivery_option: true,
                    },
                },
                reviews: {
                    orderBy: { createdAt: "desc" },
                    take: 10,
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                profile: { select: { full_name: true, avatar_url: true } },
                            },
                        },
                    },
                },
                authentication_requests: {
                    orderBy: [{ createdAt: Prisma.SortOrder.desc }],
                },
            },
        });

        if (!product) {
            throw new NotFoundException(`Product with ID ${id} not found`);
        }

        const [ordersCount, wishlistCount, cartCount] = await Promise.all([
            this.prismaService.orderItem.count({ where: { productId: id } }),
            this.prismaService.wishlistItem.count({ where: { productId: id } }),
            this.prismaService.cartItem.count({ where: { productId: id } }),
        ]);

        const productWithImages = this.mergeProductImageUrls(product);

        return {
            ...productWithImages,
            effective_price: product.discounted_price ?? product.original_price,
            seller: product.user,
            latest_request: product.authentication_requests?.[0] ?? null,
            admin_summary: {
                orders_count: ordersCount,
                wishlist_count: wishlistCount,
                cart_count: cartCount,
                reviews_count: product.total_reviews,
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

        const updatedProduct = await this.prismaService.product.update({
            where: { id },
            data: {
                authentication_status: status,
                is_authenticated: isAuthenticated,
                approved_at:
                    status === AuthenticationStatus.VERIFIED
                        ? now
                        : status === AuthenticationStatus.PENDING || status === AuthenticationStatus.NOT_SUBMITTED
                          ? null
                          : product.approved_at,
                rejected_at:
                    status === AuthenticationStatus.NOT_VERIFIED
                        ? now
                        : status === AuthenticationStatus.PENDING || status === AuthenticationStatus.NOT_SUBMITTED
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

        try {
            const statusMessage =
                status === AuthenticationStatus.VERIFIED
                    ? "verified"
                    : status === AuthenticationStatus.NOT_VERIFIED
                      ? "not verified"
                      : status === AuthenticationStatus.PENDING
                        ? "pending review"
                        : "not submitted";

            await this.notificationService.create(
                updatedProduct.user.id,
                "Product authentication update",
                `Your product "${updatedProduct.name}" is now ${statusMessage}.`,
                NotificationType.AUTHENTICATION,
            );
        } catch (error) {
            console.error("Failed to send product authentication notification", error);
        }

        return updatedProduct;
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

    private async getUserCurrency(userId: number): Promise<CurrencyPreference> {
        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            select: { currency_preference: true },
        });

        return user?.currency_preference ?? CurrencyPreference.USD;
    }

    private async applyUserCurrency<T extends { original_price: number; discounted_price?: number | null; effective_price?: number; }>(
        product: T,
        currency: CurrencyPreference,
    ) {
        if (currency === CurrencyPreference.USD) {
            return {
                ...product,
                effective_price: product.discounted_price ?? product.original_price,
                currency,
            };
        }

        const baseCurrency = CurrencyPreference.USD;
        const originalPrice = await this.currencyService.convertPrice(product.original_price, baseCurrency, currency);
        const discountedPrice = await this.currencyService.convertPrice(product.discounted_price ?? null, baseCurrency, currency);

        return {
            ...product,
            original_price: originalPrice ?? 0,
            discounted_price: discountedPrice,
            effective_price: discountedPrice ?? originalPrice ?? 0,
            currency,
        };
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

    private mergeProductImageUrls(product: any) {
        const productImages = Array.isArray(product?.image_urls) ? product.image_urls : [];
        const authImages = Array.isArray(product?.authentication_requests?.[0]?.image_urls)
            ? product.authentication_requests[0].image_urls
            : [];

        const merged = [...productImages, ...authImages].filter((value, index, array) => value && array.indexOf(value) === index);

        return { ...product, image_urls: merged, image_url: merged[0] ?? null };
    }

    private async getSellerStats(sellerId: number) {
        const [productCount, orderItemCount, ratingAggregate] = await Promise.all([
            this.prismaService.product.count({
                where: {
                    userId: sellerId,
                    status: "ACTIVE",
                    user: this.getSellerPaymentSetupWhere(),
                },
            }),
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
                user: this.getSellerPaymentSetupWhere(),
                ...(userId ? { userId: { not: userId } } : {}),
            },
            take: 4,
            orderBy: [{ average_rating: "desc" }, { createdAt: "desc" }],
            include: {
                category: true,
                subCategory: true,
            },
        });

        const wishlistedIds = await this.getWishlistedProductIds(userId, products.map((product) => product.id));
        return this.withWishlistState(products, wishlistedIds);
    }

    private deriveSellerProductStatus(product: any) {
        const latestRequest = product.authentication_requests?.[0];

        if (product.status === ProductStatus.SOLD) {
            return SellerProductStatus.SOLD;
        }

        if (product.status === ProductStatus.ACTIVE && product.authentication_status === AuthenticationStatus.VERIFIED) {
            return SellerProductStatus.LIVE;
        }

        if (product.authentication_status === AuthenticationStatus.NOT_VERIFIED) {
            return SellerProductStatus.REJECTED;
        }

        if (product.authentication_status === AuthenticationStatus.PENDING) {
            const requestStatus = latestRequest?.status?.toLowerCase();
            if (requestStatus === "update-needed" || requestStatus === "photo-update-needed") {
                return SellerProductStatus.ACTION_REQUIRED;
            }

            // If a pending request is still open, the product is under review.
            return SellerProductStatus.UNDER_REVIEW;
        }

        if (product.status === ProductStatus.INACTIVE) {
            return SellerProductStatus.INACTIVE;
        }

        return SellerProductStatus.INACTIVE;
    }

    private excludeViewerProducts(whereClause: any, userId?: number) {
        if (!userId) {
            return;
        }

        const existingAnd = Array.isArray(whereClause.AND)
            ? whereClause.AND
            : whereClause.AND
              ? [whereClause.AND]
              : [];

        whereClause.AND = [...existingAnd, { userId: { not: userId } }];
    }

    private requireSellerPaymentSetup(whereClause: any) {
        whereClause.user = this.getSellerPaymentSetupWhere();
    }

    private getSellerPaymentSetupWhere() {
        return {
            stripe_onboarding_complete: true,
            stripe_account_id: { not: null },
        };
    }

    private hasSellerPaymentSetup(seller?: {
        stripe_onboarding_complete?: boolean | null;
        stripe_account_id?: string | null;
    } | null) {
        return Boolean(seller?.stripe_onboarding_complete && seller.stripe_account_id);
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

        const subCategory = await this.prismaService.subCategory.findUnique({ where: { id: subCategoryId } });
        if (!subCategory) {
            throw new NotFoundException(`Sub-category with ID ${subCategoryId} not found`);
        }
        if (subCategory.categoryId !== categoryId) {
            throw new BadRequestException(`Sub-category with ID ${subCategoryId} does not belong to Category with ID ${categoryId}`);
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

        if ((requestedStatus ?? ProductStatus.INACTIVE) === ProductStatus.ACTIVE) {
            if (!readiness.delivery_configured) {
                throw new ForbiddenException({
                    code: "DELIVERY_INFORMATION_MISSING",
                    message: "Complete delivery settings before making products available for purchase.",
                    readiness,
                });
            }

            // A brand-new product can never already be VERIFIED — it must be created first,
            // then submitted to LegitGrails, then flipped to ACTIVE once authenticated.
            throw new ForbiddenException({
                code: "AUTHENTICATION_REQUIRED",
                message: "New listings must be submitted for LegitGrails authentication before they can go live. Create it as INACTIVE, then activate it once verified.",
            });
        }
    }

    private async assertCanPublishProduct(sellerId: number, authenticationStatus: AuthenticationStatus) {
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
        if (authenticationStatus !== AuthenticationStatus.VERIFIED) {
            throw new ForbiddenException({
                code: "AUTHENTICATION_REQUIRED",
                message: "This item must be verified by LegitGrails before it can be listed for sale.",
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
            user: {
                select: {
                    id: true,
                    email: true,
                    seller_tier: true,
                    stripe_onboarding_complete: true,
                    profile: { select: { full_name: true, avatar_url: true, country: true } },
                },
            },
            authentication_requests: {
                orderBy: [{ createdAt: Prisma.SortOrder.desc }],
                take: 1,
            },
        };
    }

    private assertCanMutateProduct(product: { userId: number }, actorId: number, isAdmin = false) {
        if (!isAdmin && product.userId !== actorId) {
            throw new ForbiddenException("You do not have permission to modify this product");
        }
    }

    private formatSellerProductCard(product: any) {
        return {
            id: product.id,
            name: product.name,
            status: product.status,
            seller_status: this.deriveSellerProductStatus(product),
            category: product.category,
            subCategory: product.subCategory,
            image_urls: product.image_urls,
            image_url: product.image_urls?.[0] ?? null,
            grade: product.grade,
            original_price: product.original_price,
            discounted_price: product.discounted_price,
            effective_price: product.discounted_price ?? product.original_price,
            discount_percentage: product.discount_percentage,
            average_rating: product.average_rating ?? 0,
            total_reviews: product.total_reviews,
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
            brand: product.brand,
            is_authenticated: product.is_authenticated,
            authentication_status: product.authentication_status,
            approved_at: product.approved_at,
            rejected_at: product.rejected_at,
            sold_at: product.sold_at,
            seller: product.user,
            latest_request: product.authentication_requests?.[0] ?? null,
        };
    }
}
