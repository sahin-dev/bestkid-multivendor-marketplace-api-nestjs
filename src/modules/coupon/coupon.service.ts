import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { CouponDiscountType, CouponUsageType } from "generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CouponQueryDto, CouponStatusFilter } from "./dtos/coupon-query.dto";
import { CreateCouponDto, UpdateCouponDto } from "./dtos/upsert-coupon.dto";

@Injectable()
export class CouponService {
    constructor(private readonly prismaService: PrismaService) {}

    async findAll(query: CouponQueryDto) {
        const { page = 1, limit = 10, search, status, discount_type, usage_type } = query;
        const skip = (page - 1) * limit;
        const now = new Date();

        const where: any = {};
        const andFilters: any[] = [];

        if (search) {
            andFilters.push({
                OR: [
                    { code: { contains: search, mode: "insensitive" } },
                    { campaign_reason: { contains: search, mode: "insensitive" } },
                ],
            });
        }

        if (discount_type) {
            where.discount_type = discount_type;
        }

        if (usage_type) {
            where.usage_type = usage_type;
        }

        if (status === CouponStatusFilter.ACTIVE) {
            where.is_active = true;
            where.start_date = { lte: now };
            where.end_date = { gte: now };
        } else if (status === CouponStatusFilter.EXPIRED) {
            andFilters.push({ end_date: { lt: now } });
        } else if (status === CouponStatusFilter.INACTIVE) {
            where.is_active = false;
        }

        if (andFilters.length) {
            where.AND = andFilters;
        }

        const [data, total] = await Promise.all([
            this.prismaService.coupon.findMany({
                where,
                skip,
                take: limit,
                include: {
                    category: true,
                    subCategory: true,
                },
                orderBy: { createdAt: "desc" },
            }),
            this.prismaService.coupon.count({ where }),
        ]);

        return {
            data: data.map((coupon) => this.formatCoupon(coupon)),
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async findById(id: number) {
        const coupon = await this.prismaService.coupon.findUnique({
            where: { id },
            include: {
                category: true,
                subCategory: true,
            },
        });

        if (!coupon) {
            throw new NotFoundException(`Coupon with ID ${id} not found`);
        }

        return this.formatCoupon(coupon);
    }

    async create(dto: CreateCouponDto) {
        await this.validateCouponInput(dto);

        const existing = await this.prismaService.coupon.findUnique({
            where: { code: dto.code.trim().toUpperCase() },
        });
        if (existing) {
            throw new ConflictException("Coupon code already exists");
        }

        const coupon = await this.prismaService.coupon.create({
            data: this.toCouponData(dto) as any,
            include: {
                category: true,
                subCategory: true,
            },
        });

        return this.formatCoupon(coupon);
    }

    async update(id: number, dto: UpdateCouponDto) {
        const existing = await this.prismaService.coupon.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundException(`Coupon with ID ${id} not found`);
        }

        await this.validateCouponInput(dto, existing);

        if (dto.code) {
            const codeOwner = await this.prismaService.coupon.findUnique({
                where: { code: dto.code.trim().toUpperCase() },
            });
            if (codeOwner && codeOwner.id !== id) {
                throw new ConflictException("Coupon code already exists");
            }
        }

        const coupon = await this.prismaService.coupon.update({
            where: { id },
            data: this.toCouponData(dto) as any,
            include: {
                category: true,
                subCategory: true,
            },
        });

        return this.formatCoupon(coupon);
    }

    async delete(id: number) {
        await this.findById(id);
        await this.prismaService.coupon.delete({ where: { id } });

        return { message: "Coupon deleted successfully" };
    }

    private async validateCouponInput(
        dto: Partial<CreateCouponDto>,
        existing?: {
            start_date: Date;
            end_date: Date;
            usage_type: CouponUsageType;
            usage_limit: number | null;
            discount_type: CouponDiscountType;
        },
    ) {
        const discountType = dto.discount_type ?? existing?.discount_type;
        const discountValue = dto.discount_value;

        if (discountType === CouponDiscountType.PERCENTAGE && discountValue !== undefined && discountValue > 100) {
            throw new BadRequestException("Percentage coupon value cannot exceed 100");
        }

        const usageType = dto.usage_type ?? existing?.usage_type ?? CouponUsageType.UNLIMITED;
        const usageLimit = dto.usage_limit ?? existing?.usage_limit;
        if (usageType === CouponUsageType.LIMITED && !usageLimit) {
            throw new BadRequestException("usage_limit is required when usage_type is LIMITED");
        }

        const startDate = dto.start_date ? new Date(dto.start_date) : existing?.start_date;
        const endDate = dto.end_date ? new Date(dto.end_date) : existing?.end_date;
        if (startDate && endDate && startDate > endDate) {
            throw new BadRequestException("start_date must be before end_date");
        }

        if (dto.categoryId) {
            const category = await this.prismaService.category.findUnique({ where: { id: dto.categoryId } });
            if (!category) {
                throw new NotFoundException(`Category with ID ${dto.categoryId} not found`);
            }
        }

        if (dto.subCategoryId) {
            const subCategory = await this.prismaService.subCategory.findUnique({ where: { id: dto.subCategoryId } });
            if (!subCategory) {
                throw new NotFoundException(`Sub-category with ID ${dto.subCategoryId} not found`);
            }
        }
    }

    private toCouponData(dto: Partial<CreateCouponDto | UpdateCouponDto>) {
        const data: Record<string, any> = {};

        if (dto.campaign_reason !== undefined) data.campaign_reason = dto.campaign_reason;
        if (dto.code !== undefined) data.code = dto.code.trim().toUpperCase();
        if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
        if (dto.subCategoryId !== undefined) data.subCategoryId = dto.subCategoryId;
        if (dto.discount_type !== undefined) data.discount_type = dto.discount_type;
        if (dto.discount_value !== undefined) data.discount_value = dto.discount_value;
        if (dto.usage_type !== undefined) {
            data.usage_type = dto.usage_type;
            if (dto.usage_type === CouponUsageType.UNLIMITED) {
                data.usage_limit = null;
            }
        }
        if (dto.usage_limit !== undefined) data.usage_limit = dto.usage_limit;
        if (dto.start_date !== undefined) data.start_date = new Date(dto.start_date);
        if (dto.end_date !== undefined) data.end_date = new Date(dto.end_date);
        if (dto.is_active !== undefined) data.is_active = dto.is_active;

        return data;
    }

    private formatCoupon<T extends { [key: string]: any }>(coupon: T) {
        const now = new Date();
        const usage =
            coupon.usage_type === CouponUsageType.UNLIMITED
                ? "Unlimited"
                : `${coupon.usage_limit ?? 0} Uses`;
        const value =
            coupon.discount_type === CouponDiscountType.PERCENTAGE
                ? `${coupon.discount_value}%`
                : `EUR ${coupon.discount_value}`;
        const status =
            coupon.is_active && coupon.start_date <= now && coupon.end_date >= now
                ? "ACTIVE"
                : coupon.end_date < now
                  ? "EXPIRED"
                  : "INACTIVE";

        return {
            ...coupon,
            status,
            value,
            usage,
            discount_category: coupon.subCategory ?? coupon.category ?? null,
            remaining_uses:
                coupon.usage_type === CouponUsageType.LIMITED && coupon.usage_limit
                    ? Math.max(coupon.usage_limit - coupon.used_count, 0)
                    : null,
        };
    }
}
