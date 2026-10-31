import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { OrderStatus, PaymentProvider, ProductStatus } from "generated/prisma/client";
import { OrderService } from "./order.service";

type OrderRow = { id: number; userId: number; sellerId: number; status: OrderStatus; items: { productId: number }[] };

describe("OrderService", () => {
    let service: OrderService;
    let prisma: any;
    let tx: any;
    let paymentService: { findPaidTransactionForOrder: jest.Mock };
    let stripeService: { refundOrderPayment: jest.Mock; expireCheckoutSessions: jest.Mock };
    let notificationService: { create: jest.Mock };
    let smtpProvider: { sendMail: jest.Mock };

    const pendingOrder: OrderRow = { id: 1, userId: 5, sellerId: 9, status: OrderStatus.PENDING, total: 100, seller: { seller_tier: "BASIC_SELLER" }, items: [{ productId: 50 }] } as any;

    beforeEach(() => {
        tx = {
            product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
            order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        };
        prisma = {
            $transaction: jest.fn(async (work: (client: any) => unknown) => work(tx)),
            order: {
                findUnique: jest.fn().mockResolvedValue(pendingOrder),
                findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 1, sellerId: 9, confirmed_at: new Date(), items: [] }),
                findMany: jest.fn().mockResolvedValue([]),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                update: jest.fn().mockResolvedValue({}),
            },
            product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
            cartItem: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
            coupon: { update: jest.fn().mockResolvedValue({}) },
            baseUser: { findUnique: jest.fn().mockResolvedValue({ currency_preference: "USD" }) },
        };
        paymentService = {
            findPaidTransactionForOrder: jest.fn().mockResolvedValue({ id: 7, provider: PaymentProvider.STRIPE }),
            findById: jest.fn().mockResolvedValue(null),
        } as any;
        stripeService = {
            refundOrderPayment: jest.fn().mockResolvedValue({ refunded: true }),
            expireCheckoutSessions: jest.fn().mockResolvedValue(undefined),
        };
        notificationService = { create: jest.fn().mockResolvedValue({}) };
        smtpProvider = { sendMail: jest.fn().mockResolvedValue(undefined) };

        service = new OrderService(
            prisma,
            {} as any,
            notificationService as any,
            {} as any,
            {} as any,
            paymentService as any,
            stripeService as any,
            smtpProvider as any,
        );
    });

    describe("finalizePaidOrders", () => {
        it("confirms a pending order, sells its items, and only then spends the coupon", async () => {
            const result = await service.finalizePaidOrders({ orderIds: [1], cartId: 3, couponId: 8 });

            expect(tx.product.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ id: 50, status: ProductStatus.ACTIVE }),
                    data: expect.objectContaining({ status: ProductStatus.SOLD }),
                }),
            );
            expect(tx.order.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 1, status: OrderStatus.PENDING },
                    data: expect.objectContaining({ status: OrderStatus.CONFIRMED }),
                }),
            );
            expect(prisma.coupon.update).toHaveBeenCalledTimes(1);
            expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: 3, productId: { in: [50] } } });
            expect(notificationService.create).toHaveBeenCalledTimes(2);
            expect(result).toEqual({ confirmed: [1], alreadySettled: [], rejected: [] });
        });

        it("snapshots what the seller keeps, so a later fee change cannot rewrite it", async () => {
            await service.finalizePaidOrders({ orderIds: [1] });

            expect(tx.order.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ platform_fee_percent: 10, seller_net_amount: 90 }),
                }),
            );
        });

        it("emails the buyer and seller, stating what the card was really charged", async () => {
            prisma.order.findUniqueOrThrow.mockResolvedValue({
                id: 1,
                total: 100,
                user: { email: "buyer@example.com", profile: { full_name: "Buyer" } },
                seller: { email: "seller@example.com", profile: { full_name: "Seller" } },
                items: [{ product: { name: "Blue <b>coat</b>" } }],
            });
            (paymentService as any).findById.mockResolvedValue({
                amount: 92.5,
                currency: "eur",
                metadata: { checkoutMode: "buy_now" },
            });

            await service.finalizePaidOrders({ orderIds: [1], paymentTransactionId: 7 });

            expect(smtpProvider.sendMail).toHaveBeenCalledTimes(2);
            const [buyerAddress, , buyerBody] = smtpProvider.sendMail.mock.calls[0];
            expect(buyerAddress).toBe("buyer@example.com");
            expect(buyerBody).toContain("92.50 EUR");
            expect(buyerBody).toContain("Blue &lt;b&gt;coat&lt;/b&gt;");
            expect(smtpProvider.sendMail.mock.calls[1][0]).toBe("seller@example.com");
        });

        it("leaves an order alone when the payment is delivered again after it shipped", async () => {
            prisma.order.findUnique.mockResolvedValue({ ...pendingOrder, status: OrderStatus.SHIPPED });

            const result = await service.finalizePaidOrders({ orderIds: [1], couponId: 8 });

            expect(tx.order.updateMany).not.toHaveBeenCalled();
            expect(prisma.coupon.update).not.toHaveBeenCalled();
            expect(result).toEqual({ confirmed: [], alreadySettled: [1], rejected: [] });
        });

        it("rejects a payment for a cancelled order rather than reviving it", async () => {
            prisma.order.findUnique.mockResolvedValue({ ...pendingOrder, status: OrderStatus.CANCELLED });

            const result = await service.finalizePaidOrders({ orderIds: [1] });

            expect(tx.order.updateMany).not.toHaveBeenCalled();
            expect(result.rejected).toEqual([1]);
        });

        it("rejects the order when the unique item was already sold to someone else", async () => {
            tx.product.updateMany.mockResolvedValue({ count: 0 });
            prisma.order.findUnique
                .mockResolvedValueOnce(pendingOrder)
                .mockResolvedValueOnce({ status: OrderStatus.PENDING });
            prisma.order.findMany.mockResolvedValue([pendingOrder]);

            const result = await service.finalizePaidOrders({ orderIds: [1], couponId: 8 });

            expect(result).toEqual({ confirmed: [], alreadySettled: [], rejected: [1] });
            expect(prisma.coupon.update).not.toHaveBeenCalled();
            expect(prisma.order.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ status: OrderStatus.CANCELLED }) }),
            );
        });

        it("treats losing a race with a duplicate delivery as success, not a conflict", async () => {
            tx.order.updateMany.mockResolvedValue({ count: 0 });
            prisma.order.findUnique
                .mockResolvedValueOnce(pendingOrder)
                .mockResolvedValueOnce({ status: OrderStatus.CONFIRMED });

            const result = await service.finalizePaidOrders({ orderIds: [1] });

            expect(result).toEqual({ confirmed: [], alreadySettled: [1], rejected: [] });
        });
    });

    describe("cancelOrder", () => {
        const paidOrder = { ...pendingOrder, status: OrderStatus.CONFIRMED };

        it("refuses a user who is not the buyer", async () => {
            await expect(service.cancelOrder(1, 999)).rejects.toBeInstanceOf(ForbiddenException);
            expect(prisma.order.updateMany).not.toHaveBeenCalled();
        });

        it("refunds a paid order and relists the item", async () => {
            prisma.order.findUnique.mockResolvedValue(paidOrder);

            await service.cancelOrder(1, 5, "changed my mind");

            expect(stripeService.refundOrderPayment).toHaveBeenCalledWith(1);
            expect(prisma.product.updateMany).toHaveBeenCalledWith({
                where: { id: { in: [50] }, status: ProductStatus.SOLD },
                data: { status: ProductStatus.ACTIVE, sold_at: null },
            });
        });

        it("tells the buyer how much was refunded", async () => {
            prisma.order.findUnique.mockResolvedValue(paidOrder);
            stripeService.refundOrderPayment.mockResolvedValue({ refunded: true, refund_amount: 92.5, currency: "eur" });
            prisma.order.findUniqueOrThrow.mockResolvedValue({
                id: 1,
                sellerId: 9,
                confirmed_at: new Date(),
                user: { email: "buyer@example.com", profile: { full_name: "Buyer" } },
                items: [],
            });

            await service.cancelOrder(1, 5);

            const [to, subject, body] = smtpProvider.sendMail.mock.calls[0];
            expect(to).toBe("buyer@example.com");
            expect(subject).toContain("cancelled");
            expect(body).toContain("92.50 EUR");
        });

        it("restores the order when the refund fails, so a cancelled order never hides unreturned money", async () => {
            prisma.order.findUnique.mockResolvedValue(paidOrder);
            stripeService.refundOrderPayment.mockRejectedValue(new Error("Stripe is down"));

            await expect(service.cancelOrder(1, 5)).rejects.toThrow("Stripe is down");

            expect(prisma.order.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ status: OrderStatus.CONFIRMED }) }),
            );
            expect(prisma.product.updateMany).not.toHaveBeenCalled();
        });

        it("closes the Stripe session of an unpaid order and does not relist a sold item", async () => {
            await service.cancelOrder(1, 5);

            expect(stripeService.expireCheckoutSessions).toHaveBeenCalledWith([1], 5);
            expect(stripeService.refundOrderPayment).not.toHaveBeenCalled();
            expect(prisma.product.updateMany).toHaveBeenCalledWith({
                where: { id: { in: [50] }, reserved_by_user_id: 5 },
                data: { reserved_until: null, reserved_by_user_id: null },
            });
        });

        it("sends TBI-financed orders to support instead of pretending to refund them", async () => {
            prisma.order.findUnique.mockResolvedValue(paidOrder);
            paymentService.findPaidTransactionForOrder.mockResolvedValue({ id: 7, provider: PaymentProvider.TBI_CREDIT });

            await expect(service.cancelOrder(1, 5)).rejects.toBeInstanceOf(BadRequestException);
            expect(prisma.order.updateMany).not.toHaveBeenCalled();
        });

        it("fails when a seller changes the order at the same moment", async () => {
            prisma.order.findUnique.mockResolvedValue(paidOrder);
            prisma.order.updateMany.mockResolvedValue({ count: 0 });

            await expect(service.cancelOrder(1, 5)).rejects.toBeInstanceOf(ConflictException);
            expect(stripeService.refundOrderPayment).not.toHaveBeenCalled();
        });
    });

    describe("status updates", () => {
        it("does not let a seller confirm an unpaid order", async () => {
            prisma.order.findFirst = jest.fn().mockResolvedValue(pendingOrder);

            await expect(service.updateSellerOrderStatus(1, 9, OrderStatus.CONFIRMED)).rejects.toBeInstanceOf(BadRequestException);
        });

        it("does not let an admin push an unpaid order into fulfilment", async () => {
            await expect(service.updateOrderStatusAdmin(1, OrderStatus.SHIPPED)).rejects.toBeInstanceOf(BadRequestException);
        });

        it("refunds when an admin marks a delivered order refunded, without relisting the item", async () => {
            prisma.order.findUnique.mockResolvedValue({ ...pendingOrder, status: OrderStatus.DELIVERED });

            await service.updateOrderStatusAdmin(1, OrderStatus.REFUNDED);

            expect(stripeService.refundOrderPayment).toHaveBeenCalledWith(1);
            expect(prisma.product.updateMany).not.toHaveBeenCalled();
        });
    });

    describe("seller visibility", () => {
        it("hides an unpaid checkout from the seller", async () => {
            prisma.order.findUnique.mockResolvedValue({ ...pendingOrder, items: [] });

            await expect(service.findSellerOrderById(1, 9)).rejects.toBeInstanceOf(NotFoundException);
        });
    });
});
