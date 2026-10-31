import { validateEnv } from "./env.validation";

describe("validateEnv", () => {
    const productionEnv = {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://localhost/bestkid",
        JWT_SECRET: "a".repeat(48),
        STRIPE_KEY: "sk_live_123",
        STRIPE_WEBHOOK: "whsec_123",
        CORS_ORIGINS: "https://bestkid.eu",
        APP_URL: "https://bestkid.eu",
        MAILER_HOST: "smtp.example.com",
        MAILER_PORT: "587",
        MAILER_MAIL: "hello@bestkid.eu",
        MAILER_PASSWORD: "password",
    };

    it("ignores incomplete configuration outside production", () => {
        expect(validateEnv({ NODE_ENV: "development" })).toEqual({ NODE_ENV: "development" });
    });

    it("accepts a complete production configuration", () => {
        expect(validateEnv(productionEnv)).toBe(productionEnv);
    });

    it.each(["MySecret", "change-me-in-production", "too-short"])("refuses the weak JWT secret %s", (JWT_SECRET) => {
        expect(() => validateEnv({ ...productionEnv, JWT_SECRET })).toThrow(/JWT_SECRET/);
    });

    it("refuses wildcard CORS", () => {
        expect(() => validateEnv({ ...productionEnv, CORS_ORIGINS: "*" })).toThrow(/CORS_ORIGINS/);
    });

    it("reports every missing setting at once", () => {
        expect(() => validateEnv({ NODE_ENV: "production" })).toThrow(/DATABASE_URL[\s\S]*JWT_SECRET[\s\S]*STRIPE_KEY/);
    });

    it("requires a signing secret when LegitGrails verdicts are accepted", () => {
        expect(() => validateEnv({ ...productionEnv, LEGITGRAILS_ENABLED: "true", LEGITGRAILS_API_KEY: "key" })).toThrow(
            /LEGITGRAILS_WEBHOOK_SIGNING_SECRET/,
        );
    });

    it("requires a public webhook URL when TBI is enabled", () => {
        expect(() =>
            validateEnv({
                ...productionEnv,
                TBI_ENABLED: "true",
                TBI_BASE_URL: "https://tbi.example",
                TBI_RESELLER_CODE: "code",
                TBI_RESELLER_KEY: "key",
                TBI_ENCRYPTION_KEY: "secret",
            }),
        ).toThrow(/API_PUBLIC_URL/);
    });
});
