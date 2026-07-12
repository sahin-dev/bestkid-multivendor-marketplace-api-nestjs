import { BadRequestException } from "@nestjs/common";
import { CouponDiscountType, CouponUsageType } from "generated/prisma/enums";

jest.mock("../prisma/prisma.service", () => ({
    PrismaService: class PrismaService {},
}));

import { CouponService } from "./coupon.service";

describe("CouponService", () => {
    const createService = () => {
        const prismaService = {
            coupon: {
                findUnique: jest.fn().mockResolvedValue(null),
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

        await service.create({
            campaign_reason: "Launch",
            code: "KIDS10",
            discount_type: CouponDiscountType.PERCENTAGE,
            discount_value: 10,
            usage_type: CouponUsageType.UNLIMITED,
            usage_limit: 100,
            start_date: "2026-07-14T00:00:00.000Z",
            end_date: "2026-07-24T23:59:59.000Z",
        });

        expect(prismaService.coupon.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    usage_type: CouponUsageType.UNLIMITED,
                    usage_limit: null,
                }),
            }),
        );
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
});
