import { BadRequestException } from "@nestjs/common";
import { GlobalHttpExceptionHandler } from "./GlobalHttpExceptionHandler";

describe("GlobalHttpExceptionHandler", () => {
    const createHost = (url = "/products") => {
        const status = jest.fn().mockReturnThis();
        const json = jest.fn().mockReturnThis();
        const host: any = {
            switchToHttp: () => ({
                getResponse: () => ({ status, json }),
                getRequest: () => ({ url }),
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
});
