import { Injectable, NotFoundException } from '@nestjs/common';
import { CurrencyPreference, ProductStatus } from 'generated/prisma/client';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CurrencyConversionService } from '../currency/currency.service';

@Injectable()
export class HomeService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly currencyService: CurrencyConversionService,
  ) {}

  async getHomepageData(userId?: number) {
    const purchasableProductWhere = this.getPurchasableProductWhere(userId);

    const [categories, trending, promoted, newArrivals] = await Promise.all([
      this.prismaService.category.findMany({
        include: {
          subCategories: { select: { id: true, name: true } },
          _count: { select: { products: { where: purchasableProductWhere } } },
        },
        orderBy: { createdAt: 'asc' },
      }),

      this.prismaService.product.findMany({
        where: purchasableProductWhere,
        orderBy: { views: 'desc' },
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
          user: {
            select: {
              id: true,
              profile: { select: { full_name: true, avatar_url: true } },
            },
          },
        },
      }),

      this.prismaService.product.findMany({
        where: {
          ...purchasableProductWhere,
          OR: [{ discount_percentage: { gt: 0 } }, { is_authenticated: true }],
        },
        orderBy: [{ discount_percentage: 'desc' }, { views: 'desc' }],
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
          user: {
            select: {
              id: true,
              profile: { select: { full_name: true, avatar_url: true } },
            },
          },
        },
      }),

      this.prismaService.product.findMany({
        where: purchasableProductWhere,
        orderBy: { createdAt: 'desc' },
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
          user: {
            select: {
              id: true,
              profile: { select: { full_name: true, avatar_url: true } },
            },
          },
        },
      }),
    ]);

    const productIds = [...trending, ...promoted, ...newArrivals].map(
      (product) => product.id,
    );
    const wishlistedIds = await this.getWishlistedProductIds(
      userId,
      productIds,
    );
    const userCurrency = await this.getUserCurrency(userId);

    return {
      categories: categories.map((category) => ({
        ...category,
        product_count: category._count.products,
        _count: undefined,
      })),
      trending: await this.withWishlistState(trending, wishlistedIds, userCurrency),
      promoted: await this.withWishlistState(promoted, wishlistedIds, userCurrency),
      new_arrivals: await this.withWishlistState(newArrivals, wishlistedIds, userCurrency),
      trust_cards: [
        { key: 'secure_payments', title: 'Secure Payments', tone: 'success' },
        { key: 'easy_returns', title: 'Easy Returns', tone: 'info' },
        { key: 'trusted_sellers', title: 'Trusted Sellers', tone: 'warning' },
        { key: 'europe_access', title: 'Europe-wide Access', tone: 'neutral' },
      ],
    };
  }

  async getTrendingProducts(
    userId?: number,
    query: PaginationDto = { page: 1, limit: 20 },
  ) {
    const { page = 1, limit = 20 } = query ?? {};
    const skip = (page - 1) * limit;
    const where = this.getPurchasableProductWhere(userId);

    const [products, total] = await Promise.all([
      this.prismaService.product.findMany({
        where,
        orderBy: [
          { views: 'desc' },
          { average_rating: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
        select: this.getProductCardSelect({ includeViews: true }),
      }),
      this.prismaService.product.count({ where }),
    ]);

    const wishlistedIds = await this.getWishlistedProductIds(
      userId,
      products.map((product) => product.id),
    );
    const userCurrency = await this.getUserCurrency(userId);

    return {
      data: await this.withWishlistState(products, wishlistedIds, userCurrency),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async getNewArrivalProducts(
    userId?: number,
    query: PaginationDto = { page: 1, limit: 20 },
  ) {
    const { page = 1, limit = 20 } = query ?? {};
    const skip = (page - 1) * limit;
    const where = this.getPurchasableProductWhere(userId);

    const [products, total] = await Promise.all([
      this.prismaService.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: this.getProductCardSelect(),
      }),
      this.prismaService.product.count({ where }),
    ]);

    const wishlistedIds = await this.getWishlistedProductIds(
      userId,
      products.map((product) => product.id),
    );
    const userCurrency = await this.getUserCurrency(userId);

    return {
      data: await this.withWishlistState(products, wishlistedIds, userCurrency),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async getFeaturedCoupon() {
    const now = new Date();
    const coupon = await this.prismaService.coupon.findFirst({
      where: {
        featured: true,
        is_active: true,
        start_date: { lte: now },
        end_date: { gte: now },
      },
      include: {
        category: true,
        subCategory: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!coupon) {
      throw new NotFoundException('No featured coupon is currently available');
    }

    return {
      ...coupon,
      status: coupon.is_active && coupon.start_date <= now && coupon.end_date >= now ? 'ACTIVE' : 'INACTIVE',
      discount_category: coupon.subCategory ?? coupon.category ?? null,
    };
  }

  async getUserPreferences(userId: number) {
    const user = await this.prismaService.baseUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        currency_preference: true,
        language_preference: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      currency_preference: user.currency_preference,
      language_preference: user.language_preference,
    };
  }

  async getRecentlyViewedForUser(
    userId: number,
    query: PaginationDto = { page: 1, limit: 10 },
  ) {
    const { page = 1, limit = 10 } = query ?? {};
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      this.prismaService.recentlyView.findMany({
        where: this.getRecentlyViewedWhere(userId),
        orderBy: { viewedAt: 'desc' },
        skip,
        take: limit,
        include: {
          product: {
            select: {
              ...this.getProductCardSelect(),
              status: true,
            },
          },
        },
      }),
      this.prismaService.recentlyView.count({
        where: this.getRecentlyViewedWhere(userId),
      }),
    ]);

    const userCurrency = await this.getUserCurrency(userId);
    const wishlistedIds = await this.getWishlistedProductIds(
      userId,
      records.map((r) => r.product.id),
    );
    const data = await Promise.all(
      records.map(async (r) => ({
        ...(await this.applyUserCurrency(r.product, userCurrency)),
        is_wishlisted: wishlistedIds.has(r.product.id),
        viewed_at: r.viewedAt,
      })),
    );

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  private async getWishlistedProductIds(
    userId: number | undefined,
    productIds: number[],
  ) {
    if (!userId || productIds.length === 0) {
      return new Set<number>();
    }

    const items = await this.prismaService.wishlistItem.findMany({
      where: { userId, productId: { in: [...new Set(productIds)] } },
      select: { productId: true },
    });

    return new Set(items.map((item) => item.productId));
  }

  private getPurchasableProductWhere(userId?: number) {
    return {
      status: ProductStatus.ACTIVE,
      user: {
        stripe_onboarding_complete: true,
        stripe_account_id: { not: null },
      },
      ...(userId ? { userId: { not: userId } } : {}),
    };
  }

  private getRecentlyViewedWhere(userId: number) {
    return {
      userId,
      product: {
        ...this.getPurchasableProductWhere(),
      },
    };
  }

  private async getUserCurrency(userId?: number): Promise<CurrencyPreference> {
    if (!userId) {
      return CurrencyPreference.USD;
    }

    const user = await this.prismaService.baseUser.findUnique({
      where: { id: userId },
      select: { currency_preference: true },
    });

    return user?.currency_preference ?? CurrencyPreference.USD;
  }

  private async withWishlistState<
    T extends {
      id: number;
      original_price: number;
      discounted_price?: number | null;
    },
  >(products: T[], wishlistedIds: Set<number>, currency: CurrencyPreference) {
    return Promise.all(
      products.map(async (product) => ({
        ...(await this.applyUserCurrency(product, currency)),
        is_wishlisted: wishlistedIds.has(product.id),
      })),
    );
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

  private getProductCardSelect(options: { includeViews?: boolean } = {}) {
    return {
      id: true,
      name: true,
      grade: true,
      original_price: true,
      discounted_price: true,
      discount_percentage: true,
      image_urls: true,
      average_rating: true,
      total_reviews: true,
      condition: true,
      ...(options.includeViews ? { views: true } : {}),
      category: { select: { id: true, name: true } },
      user: {
        select: {
          id: true,
          profile: { select: { full_name: true, avatar_url: true } },
        },
      },
    };
  }
}
