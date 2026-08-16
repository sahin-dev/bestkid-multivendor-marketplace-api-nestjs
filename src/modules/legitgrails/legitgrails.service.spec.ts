jest.mock("../prisma/prisma.service", () => ({ PrismaService: class {} }));
jest.mock("../product/product.service", () => ({ ProductService: class {} }));
jest.mock("./legitgrails.client", () => ({ LegitGrailsClient: class {} }));
jest.mock("./legitgrails.mapper", () => ({ mapLegitGrailsResult: jest.fn() }));

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

        const service = new LegitGrailsService(
            prismaService,
            client,
            {} as any,
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
});
