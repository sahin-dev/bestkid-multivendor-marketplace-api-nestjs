import { SellerTier } from "generated/prisma/client";
import { PaymentService } from "./payment.service";

describe("PaymentService", () => {
    describe("getSellerEarnings", () => {
        it("uses the fee snapshot, and the current tier only for older orders", async () => {
            const aggregate = jest
                .fn()
                .mockResolvedValueOnce({ _sum: { total: 100, seller_net_amount: 85 } })
                .mockResolvedValueOnce({ _sum: { total: 50 } });
            const service = new PaymentService({ order: { aggregate } } as any);

            await expect(service.getSellerEarnings({ sellerId: 1 }, SellerTier.BASIC_SELLER)).resolves.toEqual({
                gross: 150,
                net: 130,
            });
        });

        it("returns zero for a seller with no sales", async () => {
            const aggregate = jest.fn().mockResolvedValue({ _sum: { total: null, seller_net_amount: null } });
            const service = new PaymentService({ order: { aggregate } } as any);

            await expect(service.getSellerEarnings({ sellerId: 1 }, SellerTier.BASIC_SELLER)).resolves.toEqual({
                gross: 0,
                net: 0,
            });
        });
    });

    describe("getManualPayout", () => {
        const service = new PaymentService({} as any);
        const order = { id: 10, total: 100, platform_fee_percent: 10, seller_net_amount: 90 };

        it("uses the share fixed when a buy-now application was made", () => {
            const transaction = { currency: "eur", metadata: { sellerTransferAmount: 82.8 } };

            expect(service.getManualPayout(transaction, order)).toEqual({ amount: 82.8, currency: "eur" });
        });

        it("finds this order's share of a cart", () => {
            const transaction = {
                currency: "eur",
                metadata: {
                    cartSplitPlan: [
                        { orderId: 9, sellerTransferAmount: 10 },
                        { orderId: 10, sellerTransferAmount: 82.8 },
                    ],
                },
            };

            expect(service.getManualPayout(transaction, order).amount).toBe(82.8);
        });

        it("shrinks in proportion to a refunded return", () => {
            const transaction = { currency: "eur", metadata: { sellerTransferAmount: 80 } };

            expect(service.getManualPayout(transaction, { ...order, seller_net_amount: 45 }).amount).toBe(40);
        });
    });
});
