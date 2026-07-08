import { Injectable } from "@nestjs/common";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class HomeService {
    constructor(private readonly prismaService: PrismaService) {}

    async getHomepageData(userId?: number) {
        const [categories, trending, promoted, newArrivals] = await Promise.all([
            this.prismaService.category.findMany({
                include: {
                    subCategories: { select: { id: true, name: true } },
                    _count: { select: { products: { where: { status: "ACTIVE" } } } },
                },
                orderBy: { createdAt: "asc" },
            }),

            this.prismaService.product.findMany({
                where: { status: "ACTIVE" },
                orderBy: { views: "desc" },
                take: 5,
                select: {
                    id: true,
                    name: true,
                    original_price: true,
                    discounted_price: true,
                    discount_percentage: true,
                    image_urls: true,
                    average_rating: true,
                    total_reviews: true,
                    views: true,
                    category: { select: { id: true, name: true } },
                    user: { select: { id: true, profile: { select: { full_name: true, avatar_url: true } } } },
                },
            }),

            this.prismaService.product.findMany({
                where: {
                    status: "ACTIVE",
                    OR: [
                        { discount_percentage: { gt: 0 } },
                        { is_authenticated: true },
                    ],
                },
                orderBy: [{ discount_percentage: "desc" }, { views: "desc" }],
                take: 5,
                select: {
                    id: true,
                    name: true,
                    original_price: true,
                    discounted_price: true,
                    discount_percentage: true,
                    image_urls: true,
                    average_rating: true,
                    total_reviews: true,
                    condition: true,
                    is_authenticated: true,
                    category: { select: { id: true, name: true } },
                    user: { select: { id: true, profile: { select: { full_name: true, avatar_url: true } } } },
                },
            }),

            this.prismaService.product.findMany({
                where: { status: "ACTIVE" },
                orderBy: { createdAt: "desc" },
                take: 10,
                select: {
                    id: true,
                    name: true,
                    original_price: true,
                    discounted_price: true,
                    discount_percentage: true,
                    image_urls: true,
                    average_rating: true,
                    total_reviews: true,
                    condition: true,
                    category: { select: { id: true, name: true } },
                    user: { select: { id: true, profile: { select: { full_name: true, avatar_url: true } } } },
                },
            }),
        ]);

        const productIds = [...trending, ...promoted, ...newArrivals].map((product) => product.id);
        const wishlistedIds = await this.getWishlistedProductIds(userId, productIds);

        return {
            categories: categories.map((category) => ({
                ...category,
                product_count: category._count.products,
                _count: undefined,
            })),
            trending: this.withWishlistState(trending, wishlistedIds),
            promoted: this.withWishlistState(promoted, wishlistedIds),
            new_arrivals: this.withWishlistState(newArrivals, wishlistedIds),
            trust_cards: [
                { key: "secure_payments", title: "Secure Payments", tone: "success" },
                { key: "easy_returns", title: "Easy Returns", tone: "info" },
                { key: "trusted_sellers", title: "Trusted Sellers", tone: "warning" },
                { key: "europe_access", title: "Europe-wide Access", tone: "neutral" },
            ],
        };
    }

    async getRecentlyViewedForUser(userId: number, query: PaginationDto = { page: 1, limit: 10 }) {
        const { page = 1, limit = 10 } = query ?? {};
        const skip = (page - 1) * limit;

        const [records, total] = await Promise.all([
            this.prismaService.recentlyView.findMany({
                where: { userId },
                orderBy: { viewedAt: "desc" },
                skip,
                take: limit,
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            original_price: true,
                            discounted_price: true,
                            discount_percentage: true,
                            image_urls: true,
                            average_rating: true,
                            status: true,
                            category: { select: { id: true, name: true } },
                        },
                    },
                },
            }),
            this.prismaService.recentlyView.count({ where: { userId } }),
        ]);

        return {
            data: records.map((r) => ({ ...r.product, viewed_at: r.viewedAt })),
            meta: { total, page, limit, pages: Math.ceil(total / limit) },
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
}
