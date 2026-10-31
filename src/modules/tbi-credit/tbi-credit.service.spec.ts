import { UnauthorizedException } from "@nestjs/common";
import { PaymentStatus } from "generated/prisma/client";
import { TbiCreditService } from "./tbi-credit.service";

describe("TbiCreditService status updates", () => {
    const openTransaction = {
        id: 7,
        status: PaymentStatus.PENDING,
        provider_application_id: null,
        metadata: { orderId: "1", tbiOrderId: "tbi-1", tbiToken: "token-1" },
    };

    let prisma: any;
    let orderService: { finalizePaidOrders: jest.Mock; cancelPendingPaymentOrders: jest.Mock };
    let paymentService: { findByProviderReferenceId: jest.Mock; findByProviderApplicationId: jest.Mock; updateProviderStatus: jest.Mock };
    let client: { getApplicationStatus: jest.Mock };

    const createService = (config: Record<string, unknown> = {}) =>
        new TbiCreditService(prisma, orderService as any, paymentService as any, client as any, {} as any, {
            enabled: true,
            reservation_minutes: 2880,
            ...config,
        } as any);

    beforeEach(() => {
        prisma = { paymentTransaction: { findUnique: jest.fn().mockResolvedValue(openTransaction) } };
        orderService = {
            finalizePaidOrders: jest.fn().mockResolvedValue({ confirmed: [1], alreadySettled: [], rejected: [] }),
            cancelPendingPaymentOrders: jest.fn().mockResolvedValue({ count: 1 }),
        };
        paymentService = {
            findByProviderReferenceId: jest.fn().mockResolvedValue(openTransaction),
            findByProviderApplicationId: jest.fn(),
            updateProviderStatus: jest.fn(async (_id, params) => params),
        };
        client = { getApplicationStatus: jest.fn().mockResolvedValue({ Status: "pending" }) };
    });

    it("ignores a forged approval and acts on what TBI itself reports", async () => {
        await createService().handleStatusUpdate({ OrderId: "1", Status: "approved" });

        expect(client.getApplicationStatus).toHaveBeenCalledWith("tbi-1", "token-1");
        expect(orderService.finalizePaidOrders).not.toHaveBeenCalled();
    });

    it("settles the order when TBI confirms the approval", async () => {
        client.getApplicationStatus.mockResolvedValue({ Status: "approved" });

        await createService().handleStatusUpdate({ OrderId: "1", Status: "approved" });

        expect(orderService.finalizePaidOrders).toHaveBeenCalledTimes(1);
    });

    it("rejects an unsigned update it has no way of verifying", async () => {
        paymentService.findByProviderReferenceId.mockResolvedValue({ ...openTransaction, metadata: { orderId: "1" } });

        await expect(createService().handleStatusUpdate({ OrderId: "1", Status: "approved" })).rejects.toBeInstanceOf(UnauthorizedException);
        expect(orderService.finalizePaidOrders).not.toHaveBeenCalled();
    });

    it("rejects a bad signature when a secret is configured", async () => {
        await expect(
            createService({ webhook_secret: "secret" }).handleStatusUpdate({ OrderId: "1" }, Buffer.from("{}"), "forged"),
        ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it.each(["Not approved", "Application rejected", "declined"])("never reads %s as an approval", async (Status) => {
        client.getApplicationStatus.mockResolvedValue({ Status });

        await createService().handleStatusUpdate({ OrderId: "1" });

        expect(orderService.finalizePaidOrders).not.toHaveBeenCalled();
    });

    it("does not reopen a payment that has already been approved", async () => {
        prisma.paymentTransaction.findUnique.mockResolvedValue({ ...openTransaction, status: PaymentStatus.SUCCEEDED });

        await createService().handleStatusUpdate({ OrderId: "1" });

        expect(paymentService.updateProviderStatus).not.toHaveBeenCalled();
        expect(orderService.cancelPendingPaymentOrders).not.toHaveBeenCalled();
    });

    it("does not echo the stored access token back to the client", async () => {
        const result = await createService().handleStatusUpdate({ OrderId: "1" });

        expect(JSON.stringify(result)).not.toContain("token-1");
    });
});
