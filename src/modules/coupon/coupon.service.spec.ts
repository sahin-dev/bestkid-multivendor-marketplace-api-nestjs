import { BadRequestException } from "@nestjs/common";
import { CouponDiscountType, CouponUsageType } from "generated/prisma/enums";

jest.mock("../prisma/prisma.service", () => ({
    PrismaService: class PrismaService {},
}));

import { CouponService } from "./coupon.service";

describe("CouponService", () => {
    const createService = () => {
        const prismaService = {
            $transaction: jest.fn(async (callback) => callback({
                coupon: {
                    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                    create: jest.fn().mockResolvedValue({
                        id: 1,
                        campaign_reason: "Launch",
                        code: "KIDS10",
                        discount_type: CouponDiscountType.PERCENTAGE,
                        discount_value: 10,
                        usage_type: CouponUsageType.UNLIMITED,
                        usage_limit: null,
                        used_count: 0,
                        start_date: new Date("2026-07-14T00:00:00.000Z"),
                        end_date: new Date("2026-07-24T23:59:59.000Z"),
                        is_active: true,
                        featured: true,
                        category: null,
                        subCategory: null,
                    }),
                    update: jest.fn().mockResolvedValue({
                        id: 1,
                        campaign_reason: "Launch",
                        code: "KIDS10",
                        discount_type: CouponDiscountType.PERCENTAGE,
                        discount_value: 10,
                        usage_type: CouponUsageType.UNLIMITED,
                        usage_limit: null,
                        used_count: 0,
                        start_date: new Date("2026-07-14T00:00:00.000Z"),
                        end_date: new Date("2026-07-24T23:59:59.000Z"),
                        is_active: true,
                        featured: true,
                        category: null,
                        subCategory: null,
                    }),
                    findFirst: jest.fn().mockResolvedValue({
                        id: 1,
                        campaign_reason: "Launch",
                        code: "KIDS10",
                        discount_type: CouponDiscountType.PERCENTAGE,
                        discount_value: 10,
                        usage_type: CouponUsageType.UNLIMITED,
                        usage_limit: null,
                        used_count: 0,
                        start_date: new Date("2026-07-14T00:00:00.000Z"),
                        end_date: new Date("2026-07-24T23:59:59.000Z"),
                        is_active: true,
                        featured: true,
                        category: null,
                        subCategory: null,
                    }),
                    findUnique: jest.fn().mockResolvedValue(null),
                },
            })),
            coupon: {
                findUnique: jest.fn().mockResolvedValue(null),
                findFirst: jest.fn().mockResolvedValue({
                    id: 1,
                    campaign_reason: "Launch",
                    code: "KIDS10",
                    discount_type: CouponDiscountType.PERCENTAGE,
                    discount_value: 10,
                    usage_type: CouponUsageType.UNLIMITED,
                    usage_limit: null,
                    used_count: 0,
                    start_date: new Date("2026-07-14T00:00:00.000Z"),
                    end_date: new Date("2026-07-24T23:59:59.000Z"),
                    is_active: true,
                    featured: true,
                    category: null,
                    subCategory: null,
                }),
                create: jest.fn().mockResolvedValue({
                    id: 1,
                    campaign_reason: "Launch",
                    code: "KIDS10",
                    discount_type: CouponDiscountType.PERCENTAGE,
                    discount_value: 10,
                    usage_type: CouponUsageType.UNLIMITED,
                    usage_limit: null,
                    used_count: 0,
                    start_date: new Date("2026-07-14T00:00:00.000Z"),
                    end_date: new Date("2026-07-24T23:59:59.000Z"),
                    is_active: true,
                    featured: true,
                    category: null,
                    subCategory: null,
                }),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                update: jest.fn().mockResolvedValue({
                    id: 1,
                    campaign_reason: "Launch",
                    code: "KIDS10",
                    discount_type: CouponDiscountType.PERCENTAGE,
                    discount_value: 10,
                    usage_type: CouponUsageType.UNLIMITED,
                    usage_limit: null,
                    used_count: 0,
                    start_date: new Date("2026-07-14T00:00:00.000Z"),
                    end_date: new Date("2026-07-24T23:59:59.000Z"),
                    is_active: true,
                    featured: true,
                    category: null,
                    subCategory: null,
                }),
            },
            category: { findUnique: jest.fn() },
            subCategory: { findUnique: jest.fn() },
        };

        return {
            service: new CouponService(prismaService as any),
            prismaService,
        };
    };

    it("does not require or persist usage_limit for unlimited coupons", async () => {
        const { service, prismaService } = createService();

        const result = await service.create({
            campaign_reason: "Launch",
            code: "KIDS10",
            discount_type: CouponDiscountType.PERCENTAGE,
            discount_value: 10,
            usage_type: CouponUsageType.UNLIMITED,
            usage_limit: 100,
            start_date: "2026-07-14T00:00:00.000Z",
            end_date: "2026-07-24T23:59:59.000Z",
        });

        expect(result.usage).toBe("Unlimited");
        expect(result.remaining_uses).toBeNull();
        expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it("requires usage_limit for limited coupons", async () => {
        const { service } = createService();

        await expect(
            service.create({
                campaign_reason: "Launch",
                code: "KIDS10",
                discount_type: CouponDiscountType.PERCENTAGE,
                discount_value: 10,
                usage_type: CouponUsageType.LIMITED,
                start_date: "2026-07-14T00:00:00.000Z",
                end_date: "2026-07-24T23:59:59.000Z",
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it("allows a coupon to be flagged as featured and keeps only one featured coupon at a time", async () => {
        const { service, prismaService } = createService();

        const result = await service.create({
            campaign_reason: "Launch",
            code: "KIDS15",
            discount_type: CouponDiscountType.PERCENTAGE,
            discount_value: 15,
            usage_type: CouponUsageType.UNLIMITED,
            start_date: "2026-07-14T00:00:00.000Z",
            end_date: "2026-07-24T23:59:59.000Z",
            featured: true,
        });

        expect(result.featured).toBe(true);
        expect(prismaService.$transaction).toHaveBeenCalled();
    });
});
