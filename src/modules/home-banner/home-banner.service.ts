import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { CouponDiscountType } from "generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
    CreateHomeBannerDto,
    UpdateHomeBannerDto,
} from "./dtos/upsert-home-banner.dto";
import { ReorderHomeBannersDto } from "./dtos/reorder-home-banners.dto";

const MAX_ACTIVE_BANNERS = 4;

@Injectable()
export class HomeBannerService {
    constructor(private readonly prismaService: PrismaService) {}

    async findAllForAdmin() {
        const banners = await this.prismaService.homeBanner.findMany({
            orderBy: [{ sort_order: "asc" }, { createdAt: "desc" }],
            include: this.getBannerInclude(),
        });

        return { data: banners.map((banner) => this.formatBanner(banner)) };
    }

    async findActiveForHomepage() {
        const now = new Date();
        const banners = await this.prismaService.homeBanner.findMany({
            where: {
                is_active: true,
                AND: [
                    { OR: [{ start_date: null }, { start_date: { lte: now } }] },
                    { OR: [{ end_date: null }, { end_date: { gte: now } }] },
                ],
            },
            orderBy: [{ sort_order: "asc" }, { createdAt: "desc" }],
            take: MAX_ACTIVE_BANNERS,
            include: this.getBannerInclude(),
        });

        return banners.map((banner) => this.formatBanner(banner));
    }

    async findById(id: number) {
        const banner = await this.prismaService.homeBanner.findUnique({
            where: { id },
            include: this.getBannerInclude(),
        });

        if (!banner) {
            throw new NotFoundException(`Home banner with ID ${id} not found`);
        }

        return this.formatBanner(banner);
    }

    async create(dto: CreateHomeBannerDto) {
        await this.validateBannerInput(dto);
        await this.assertActiveBannerLimit(dto.is_active ?? true);

        const sortOrder = dto.sort_order ?? await this.getNextSortOrder();
        const banner = await this.prismaService.homeBanner.create({
            data: {
                ...this.toBannerData(dto),
                sort_order: sortOrder,
            } as any,
            include: this.getBannerInclude(),
        });

        return this.formatBanner(banner);
    }

    async update(id: number, dto: UpdateHomeBannerDto) {
        const existing = await this.prismaService.homeBanner.findUnique({
            where: { id },
        });

        if (!existing) {
            throw new NotFoundException(`Home banner with ID ${id} not found`);
        }

        await this.validateBannerInput(dto, existing);
        const willBeActive = dto.is_active ?? existing.is_active;
        if (willBeActive) {
            await this.assertActiveBannerLimit(true, id);
        }

        const banner = await this.prismaService.homeBanner.update({
            where: { id },
            data: this.toBannerData(dto),
            include: this.getBannerInclude(),
        });

        return this.formatBanner(banner);
    }

    async delete(id: number) {
        await this.findById(id);
        await this.prismaService.homeBanner.delete({ where: { id } });

        return { message: "Home banner deleted successfully" };
    }

    async reorder(dto: ReorderHomeBannersDto) {
        const ids = dto.banners.map((banner) => banner.id);
        const uniqueIds = new Set(ids);
        if (uniqueIds.size !== ids.length) {
            throw new BadRequestException("Duplicate banner IDs are not allowed.");
        }

        const existingCount = await this.prismaService.homeBanner.count({
            where: { id: { in: ids } },
        });
        if (existingCount !== ids.length) {
            throw new BadRequestException("One or more banners were not found.");
        }

        await this.prismaService.$transaction(
            dto.banners.map((banner) =>
                this.prismaService.homeBanner.update({
                    where: { id: banner.id },
                    data: { sort_order: banner.sort_order },
                }),
            ),
        );

        return this.findAllForAdmin();
    }

    private async validateBannerInput(
        dto: Partial<CreateHomeBannerDto | UpdateHomeBannerDto>,
        existing?: {
            categoryId: number | null;
            subCategoryId: number | null;
            couponId: number | null;
            start_date: Date | null;
            end_date: Date | null;
        },
    ) {
        const categoryId = this.resolveNullableNumber("categoryId", dto, existing?.categoryId);
        const subCategoryId = this.resolveNullableNumber("subCategoryId", dto, existing?.subCategoryId);
        const couponId = this.resolveNullableNumber("couponId", dto, existing?.couponId);

        if (!categoryId && !subCategoryId) {
            throw new BadRequestException("Select a category or sub-category for the banner button.");
        }

        if (categoryId) {
            const category = await this.prismaService.category.findUnique({
                where: { id: categoryId },
            });
            if (!category) {
                throw new NotFoundException(`Category with ID ${categoryId} not found`);
            }
        }

        if (subCategoryId) {
            const subCategory = await this.prismaService.subCategory.findUnique({
                where: { id: subCategoryId },
            });
            if (!subCategory) {
                throw new NotFoundException(`Sub-category with ID ${subCategoryId} not found`);
            }
            if (categoryId && subCategory.categoryId !== categoryId) {
                throw new BadRequestException(
                    `Sub-category with ID ${subCategoryId} does not belong to Category with ID ${categoryId}`,
                );
            }
        }

        if (couponId) {
            const coupon = await this.prismaService.coupon.findUnique({
                where: { id: couponId },
            });
            if (!coupon) {
                throw new NotFoundException(`Coupon with ID ${couponId} not found`);
            }
        }

        const startDate = dto.start_date
            ? new Date(dto.start_date)
            : existing?.start_date ?? null;
        const endDate = dto.end_date
            ? new Date(dto.end_date)
            : existing?.end_date ?? null;
        if (startDate && endDate && startDate > endDate) {
            throw new BadRequestException("start_date must be before end_date");
        }
    }

    private resolveNullableNumber(
        key: "categoryId" | "subCategoryId" | "couponId",
        dto: Record<string, any>,
        existingValue?: number | null,
    ) {
        return Object.prototype.hasOwnProperty.call(dto, key)
            ? dto[key] ?? null
            : existingValue ?? null;
    }

    private async assertActiveBannerLimit(active: boolean, excludeId?: number) {
        if (!active) {
            return;
        }

        const count = await this.prismaService.homeBanner.count({
            where: {
                is_active: true,
                ...(excludeId ? { id: { not: excludeId } } : {}),
            },
        });

        if (count >= MAX_ACTIVE_BANNERS) {
            throw new BadRequestException(`Only ${MAX_ACTIVE_BANNERS} active homepage banners are allowed.`);
        }
    }

    private async getNextSortOrder() {
        const latest = await this.prismaService.homeBanner.findFirst({
            orderBy: { sort_order: "desc" },
            select: { sort_order: true },
        });

        return (latest?.sort_order ?? -1) + 1;
    }

    private toBannerData(dto: Partial<CreateHomeBannerDto | UpdateHomeBannerDto>) {
        const data: Record<string, any> = {};

        if (dto.title !== undefined) data.title = dto.title;
        if (dto.subtitle !== undefined) data.subtitle = dto.subtitle;
        if (dto.description !== undefined) data.description = dto.description;
        if (dto.image_url !== undefined) data.image_url = dto.image_url;
        if (dto.button_text !== undefined) data.button_text = dto.button_text;
        if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
        if (dto.subCategoryId !== undefined) data.subCategoryId = dto.subCategoryId;
        if (dto.couponId !== undefined) data.couponId = dto.couponId;
        if (dto.sort_order !== undefined) data.sort_order = dto.sort_order;
        if (dto.is_active !== undefined) data.is_active = dto.is_active;
        if (dto.start_date !== undefined) data.start_date = dto.start_date ? new Date(dto.start_date) : null;
        if (dto.end_date !== undefined) data.end_date = dto.end_date ? new Date(dto.end_date) : null;

        return data;
    }

    private getBannerInclude() {
        return {
            category: { select: { id: true, name: true } },
            subCategory: { select: { id: true, name: true, categoryId: true } },
            coupon: {
                include: {
                    category: true,
                    subCategory: true,
                },
            },
        };
    }

    private formatBanner(banner: any) {
        return {
            id: banner.id,
            title: banner.title,
            subtitle: banner.subtitle,
            description: banner.description,
            image_url: banner.image_url,
            button_text: banner.button_text,
            sort_order: banner.sort_order,
            is_active: banner.is_active,
            start_date: banner.start_date,
            end_date: banner.end_date,
            category: banner.category,
            sub_category: banner.subCategory,
            redirect: this.getRedirect(banner),
            coupon: banner.coupon ? this.formatCoupon(banner.coupon) : null,
            createdAt: banner.createdAt,
            updatedAt: banner.updatedAt,
        };
    }

    private getRedirect(banner: any) {
        const params = new URLSearchParams();
        if (banner.categoryId) {
            params.set("categoryId", String(banner.categoryId));
        }
        if (banner.subCategoryId) {
            params.set("subCategoryId", String(banner.subCategoryId));
        }

        return {
            type: banner.subCategoryId ? "SUB_CATEGORY" : "CATEGORY",
            categoryId: banner.categoryId ?? banner.subCategory?.categoryId ?? null,
            subCategoryId: banner.subCategoryId ?? null,
            path: `/products?${params.toString()}`,
        };
    }

    private formatCoupon(coupon: any) {
        return {
            id: coupon.id,
            code: coupon.code,
            campaign_reason: coupon.campaign_reason,
            discount_type: coupon.discount_type,
            discount_value: coupon.discount_value,
            value:
                coupon.discount_type === CouponDiscountType.PERCENTAGE
                    ? `${coupon.discount_value}%`
                    : `${coupon.discount_value}`,
            start_date: coupon.start_date,
            end_date: coupon.end_date,
            is_active: coupon.is_active,
            discount_category: coupon.subCategory ?? coupon.category ?? null,
        };
    }
}
