import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WishlistService {
    constructor(private readonly prismaService: PrismaService) {}

    async findAll(userId: number, query: PaginationDto = { page: 1, limit: 10 }) {
        const { page = 1, limit = 10 } = query ?? {};
        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            this.prismaService.wishlistItem.findMany({
                where: { userId },
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    product: {
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
                    },
                },
            }),
            this.prismaService.wishlistItem.count({ where: { userId } }),
        ]);

        return {
            data: items.map((item) => ({
                ...item.product,
                wishlist_item_id: item.id,
                is_wishlisted: true,
                saved_at: item.createdAt,
            })),
            meta: { total, page, limit, pages: Math.ceil(total / limit) },
        };
    }

    async count(userId: number) {
        const count = await this.prismaService.wishlistItem.count({ where: { userId } });
        return { count };
    }

    async add(userId: number, productId: number) {
        const product = await this.prismaService.product.findUnique({
            where: { id: productId },
            select: { id: true, status: true },
        });

        if (!product) {
            throw new NotFoundException("Product not found");
        }

        if (product.status !== "ACTIVE") {
            throw new BadRequestException("Only active products can be saved to wishlist");
        }

        const item = await this.prismaService.wishlistItem.upsert({
            where: { userId_productId: { userId, productId } },
            update: {},
            create: { userId, productId },
        });

        return { ...item, is_wishlisted: true };
    }

    async remove(userId: number, productId: number) {
        const item = await this.prismaService.wishlistItem.findUnique({
            where: { userId_productId: { userId, productId } },
        });

        if (!item) {
            return { message: "Product is not in wishlist", is_wishlisted: false };
        }

        await this.prismaService.wishlistItem.delete({ where: { id: item.id } });
        return { message: "Product removed from wishlist", is_wishlisted: false };
    }
}
