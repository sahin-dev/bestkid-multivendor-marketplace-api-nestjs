import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { PrismaService } from "../prisma/prisma.service";
import { assertEntityExists } from "src/common/validators/entity-exists.validator";
import { CurrencyPreference } from "generated/prisma/client";
import { CurrencyConversionService } from "../currency/currency.service";

@Injectable()
export class WishlistService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly currencyService: CurrencyConversionService,
    ) {}

    async findAll(userId: number, query: PaginationDto = { page: 1, limit: 10 }) {
        const { page = 1, limit = 10 } = query ?? {};
        const skip = (page - 1) * limit;

        const [items, total, userCurrency] = await Promise.all([
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
            this.getUserCurrency(userId),
        ]);

        return {
            data: await Promise.all(
                items.map(async (item) => ({
                    ...(await this.applyUserCurrency(item.product, userCurrency)),
                    wishlist_item_id: item.id,
                    is_wishlisted: true,
                    saved_at: item.createdAt,
                })),
            ),
            meta: { total, page, limit, pages: Math.ceil(total / limit) },
        };
    }

    async count(userId: number) {
        const count = await this.prismaService.wishlistItem.count({ where: { userId } });
        return { count };
    }

    async add(userId: number, productId: number) {
        await assertEntityExists(this.prismaService.baseUser, "User", userId);

        const product = await this.prismaService.product.findUnique({
            where: { id: productId },
            select: { id: true, status: true },
        });

        if (!product) {
            throw new NotFoundException(`Product with ID ${productId} not found`);
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

    private async getUserCurrency(userId: number): Promise<CurrencyPreference> {
        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            select: { currency_preference: true },
        });

        return user?.currency_preference ?? CurrencyPreference.USD;
    }

    private async applyUserCurrency<
        T extends {
            original_price: number;
            discounted_price?: number | null;
        },
    >(product: T, currency: CurrencyPreference) {
        if (currency === CurrencyPreference.USD) {
            return {
                ...product,
                effective_price: product.discounted_price ?? product.original_price,
                currency,
            };
        }

        const originalPrice = await this.currencyService.convertPrice(
            product.original_price,
            CurrencyPreference.USD,
            currency,
        );
        const discountedPrice = await this.currencyService.convertPrice(
            product.discounted_price ?? null,
            CurrencyPreference.USD,
            currency,
        );

        return {
            ...product,
            original_price: originalPrice ?? 0,
            discounted_price: discountedPrice,
            effective_price: discountedPrice ?? originalPrice ?? 0,
            currency,
        };
    }
}
