import { BadRequestException } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import { GlobalHttpExceptionHandler } from "./GlobalHttpExceptionHandler";

jest.mock("@sentry/nestjs", () => ({
    withScope: jest.fn((callback: any) =>
        callback({
            setTag: jest.fn(),
            setUser: jest.fn(),
            setContext: jest.fn(),
        }),
    ),
    captureException: jest.fn(() => "test-sentry-event-id"),
}));

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

    beforeEach(() => {
        jest.clearAllMocks();
    });

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
        expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it("returns the application error message instead of a generic internal error", () => {
        const filter = new GlobalHttpExceptionHandler();
        const { host, status, json } = createHost("/products");

        filter.catch(new Error("Database unavailable"), host);

        expect(status).toHaveBeenCalledWith(500);
        expect(json).toHaveBeenCalledWith({
            success: false,
            message: "Database unavailable",
            url: "/products",
            statusCode: 500,
            errorId: "test-sentry-event-id",
        });
        expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
    });

    it("maps Stripe SDK errors to meaningful bad request responses", () => {
        const filter = new GlobalHttpExceptionHandler();
        const { host, status, json } = createHost("/stripe/onboard");

        filter.catch(
            {
                type: "StripeInvalidRequestError",
                statusCode: 400,
                param: "return_url",
                message: "Not a valid URL",
            },
            host,
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith({
            success: false,
            message: "Stripe request failed (return_url): Not a valid URL",
            url: "/stripe/onboard",
            statusCode: 400,
            errorId: "test-sentry-event-id",
        });
        expect(Sentry.captureException).toHaveBeenCalledWith(expect.objectContaining({
            type: "StripeInvalidRequestError",
        }));
    });

    it("maps Prisma validation errors to bad request responses", () => {
        const filter = new GlobalHttpExceptionHandler();
        const { host, status, json } = createHost("/stripe/onboard");

        filter.catch(
            {
                name: "PrismaClientValidationError",
                message: "Argument `id` is missing.",
            },
            host,
        );

        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith({
            success: false,
            message: "Invalid database query. Please check the submitted fields and required IDs.",
            url: "/stripe/onboard",
            statusCode: 400,
        });
        expect(Sentry.captureException).not.toHaveBeenCalled();
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
