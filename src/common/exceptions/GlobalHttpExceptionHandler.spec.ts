import { BadRequestException } from "@nestjs/common";
import { GlobalHttpExceptionHandler } from "./GlobalHttpExceptionHandler";

describe("GlobalHttpExceptionHandler", () => {
    const createHost = (url = "/products", request: Record<string, unknown> = {}) => {
        const status = jest.fn().mockReturnThis();
        const json = jest.fn().mockReturnThis();
        const host: any = {
            switchToHttp: () => ({
                getResponse: () => ({ status, json }),
                getRequest: () => ({ url, params: {}, body: {}, ...request }),
            }),
        };

        return { host, status, json };
    };

    it("matches the documented validation error envelope", () => {
        const filter = new GlobalHttpExceptionHandler();
        const { host, status, json } = createHost("/products");

        filter.catch(new BadRequestException(["name should not be empty"]), host);

        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith({
            success: false,
            message: ["name should not be empty"],
            url: "/products",
            statusCode: 400,
        });
    });

    it("matches the documented internal server error envelope", () => {
        const filter = new GlobalHttpExceptionHandler();
        const { host, status, json } = createHost("/products");

        filter.catch(new Error("Database unavailable"), host);

        expect(status).toHaveBeenCalledWith(500);
        expect(json).toHaveBeenCalledWith({
            success: false,
            message: "Internal server error!",
            url: "/products",
            statusCode: 500,
        });
    });

    it("maps Prisma foreign-key constraint metadata to a specific entity message", () => {
        const filter = new GlobalHttpExceptionHandler();
        const { host, status, json } = createHost("/products");

        filter.catch(
            {
                code: "P2003",
                clientVersion: "7.8.0",
                meta: { field_name: "products_categoryId_fkey" },
            },
            host,
        );

        expect(status).toHaveBeenCalledWith(404);
        expect(json).toHaveBeenCalledWith({
            success: false,
            message: "Category referenced by categoryId was not found",
            url: "/products",
            statusCode: 404,
        });
    });

    it("uses submitted reference IDs when Prisma metadata is not specific", () => {
        const filter = new GlobalHttpExceptionHandler();
        const { host, status, json } = createHost("/products", { body: { categoryId: 99 } });

        filter.catch(
            {
                code: "P2003",
                clientVersion: "7.8.0",
                meta: { field_name: "foreign key" },
            },
            host,
        );

        expect(status).toHaveBeenCalledWith(404);
        expect(json).toHaveBeenCalledWith({
            success: false,
            message: "Category with ID 99 not found",
            url: "/products",
            statusCode: 404,
        });
    });
});
