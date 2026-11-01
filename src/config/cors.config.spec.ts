import { corsOriginDelegate } from "./cors.config";

describe("corsOriginDelegate", () => {
    const originalOrigins = process.env.CORS_ORIGINS;
    const originalNodeEnv = process.env.NODE_ENV;

    beforeAll(() => {
        process.env.NODE_ENV = "production";
        process.env.CORS_ORIGINS = "";
    });

    afterAll(() => {
        if (originalOrigins === undefined) {
            delete process.env.CORS_ORIGINS;
        } else {
            process.env.CORS_ORIGINS = originalOrigins;
        }

        if (originalNodeEnv === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = originalNodeEnv;
        }
    });

    it("allows the production storefront origin", () => {
        const callback = jest.fn();

        corsOriginDelegate("https://bestkid.eu", callback);

        expect(callback).toHaveBeenCalledWith(null, true);
    });

    it("continues to reject origins outside the allowlist", () => {
        const callback = jest.fn();

        corsOriginDelegate("https://untrusted.example", callback);

        expect(callback).toHaveBeenCalledWith(null, false);
    });
});
