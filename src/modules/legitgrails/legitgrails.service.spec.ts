jest.mock("../prisma/prisma.service", () => ({ PrismaService: class {} }));
jest.mock("../product/product.service", () => ({ ProductService: class {} }));
jest.mock("./legitgrails.client", () => ({ LegitGrailsClient: class {} }));
jest.mock("./legitgrails.mapper", () => ({ mapLegitGrailsResult: jest.fn() }));

import { AuthenticationStatus } from "generated/prisma/client";
import { mapLegitGrailsResult } from "./legitgrails.mapper";
import { LegitGrailsService } from "./legitgrails.service";

describe("LegitGrailsService.submitProduct", () => {
    it("resolves the default approved answer time from LegitGrails before creating the order", async () => {
        const prismaService = {
            product: {
                findUnique: jest.fn().mockResolvedValue({ id: 42, userId: 7 }),
                update: jest.fn().mockResolvedValue({}),
            },
            productAuthenticationRequest: {
                findFirst: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({ id: 99 }),
                update: jest.fn().mockResolvedValue({ id: 99 }),
            },
        } as any;

        const client = {
            listAnswerTimes: jest.fn().mockResolvedValue({
                data: [
                    { code: 720, default: true, available: true },
                    { code: 1440, default: false, available: true },
                ],
            }),
            createOrder: jest.fn().mockResolvedValue({ id: "order-1", status: "queued" }),
        } as any;

        (mapLegitGrailsResult as jest.Mock).mockReturnValue({
            externalOrderId: "order-1",
            providerStatus: "queued",
            outcome: undefined,
            productStatus: AuthenticationStatus.PENDING,
            isTerminal: false,
            hasVerdict: false,
        });

        const service = new LegitGrailsService(
            prismaService,
            client,
            {} as any,
            {
                create: jest.fn(),
            } as any,
            {
                enabled: true,
                base_url: "https://api.legitgrails.com/v1/integrations",
                api_key: "secret",
                timeout_ms: 30000,
                test_mode: false,
            } as any,
        );

        await service.submitProduct(
            42,
            7,
            {
                category_code: "bag",
                brand_code: "gucci",
                answer_time: 1440,
                photos: [{ index_code: "overall-picture", url: "https://cdn.test/overall-picture.png" }],
            } as any,
            false,
        );

        expect(client.listAnswerTimes).toHaveBeenCalledWith({
            brand_code: "gucci",
            category_code: "bag",
        });
        expect(client.createOrder).toHaveBeenCalledWith(
            expect.objectContaining({
                category_code: "bag",
                brand_code: "gucci",
                answer_time: 720,
            }),
        );
    });

    it("updates the product immediately when a test-mode response contains a final outcome", async () => {
        const prismaService = {
            product: {
                findUnique: jest.fn().mockResolvedValue({ id: 42, userId: 7 }),
                update: jest.fn().mockResolvedValue({ userId: 7 }),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            productAuthenticationRequest: {
                findFirst: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({ id: 99 }),
                update: jest.fn().mockResolvedValue({ id: 99 }),
            },
        } as any;

        const client = {
            listAnswerTimes: jest.fn().mockResolvedValue({
                data: [{ code: 720, default: true, available: true }],
            }),
            createOrder: jest.fn().mockResolvedValue({
                id: "order-1",
                status: "completed",
                outcome: "authentic",
                certificate_url: "https://cdn.test/cert.pdf",
            }),
        } as any;

        (mapLegitGrailsResult as jest.Mock).mockReturnValue({
            externalOrderId: "order-1",
            providerStatus: "completed",
            outcome: "authentic",
            productStatus: AuthenticationStatus.VERIFIED,
            isTerminal: true,
            hasVerdict: true,
            certificateUrl: "https://cdn.test/cert.pdf",
        });

        const service = new LegitGrailsService(
            prismaService,
            client,
            { getSellerProductReadiness: jest.fn().mockResolvedValue({ can_publish_product: true }) } as any,
            { create: jest.fn() } as any,
            {
                enabled: true,
                base_url: "https://api.legitgrails.com/v1/integrations",
                api_key: "secret",
                timeout_ms: 30000,
                test_mode: true,
            } as any,
        );

        await service.submitProduct(
            42,
            7,
            {
                category_code: "bag",
                brand_code: "gucci",
                answer_time: 720,
                mock_outcome: "authentic",
                photos: [{ index_code: "overall-picture", url: "https://cdn.test/overall-picture.png" }],
            } as any,
            false,
        );

        expect(prismaService.product.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 42 },
                data: expect.objectContaining({
                    authentication_status: AuthenticationStatus.VERIFIED,
                    is_authenticated: true,
                }),
            }),
        );
    });
});
