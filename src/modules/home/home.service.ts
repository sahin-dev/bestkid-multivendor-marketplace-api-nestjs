import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class HomeService {
    constructor(private readonly prismaService: PrismaService) {}

    async getHomepageData() {
        const [categories, trending, newArrivals] = await Promise.all([
            this.prismaService.category.findMany({
                include: {
                    subCategories: { select: { id: true, name: true } },
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

        return { categories, trending, new_arrivals: newArrivals };
    }

    async getRecentlyViewedForUser(userId: number) {
        const records = await this.prismaService.recentlyView.findMany({
            where: { userId },
            orderBy: { viewedAt: "desc" },
            take: 10,
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
        });
        return { data: records.map((r) => ({ ...r.product, viewed_at: r.viewedAt })) };
    }
}
