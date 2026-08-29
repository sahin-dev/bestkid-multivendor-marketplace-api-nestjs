import { registerAs } from "@nestjs/config";

export type TbiCountry = "BG" | "RO";

export const TbiCreditConfig = () => {
    const country = (process.env.TBI_COUNTRY ?? "BG").trim().toUpperCase() as TbiCountry;
    const defaultBaseUrl = country === "RO" ? "https://ro.tbi-uat.online" : "https://beta.tbibank.support";
    const defaultCurrency = country === "RO" ? "RON" : "EUR";

    return {
        enabled: process.env.TBI_ENABLED === "true",
        country,
        base_url: process.env.TBI_BASE_URL ?? defaultBaseUrl,
        reseller_code: process.env.TBI_RESELLER_CODE,
        reseller_key: process.env.TBI_RESELLER_KEY,
        encryption_key: process.env.TBI_ENCRYPTION_KEY,
        encryption_algorithm: process.env.TBI_ENCRYPTION_ALGORITHM ?? "aes-256-cbc",
        encryption_key_mode: process.env.TBI_ENCRYPTION_KEY_MODE ?? "sha256",
        encryption_iv: process.env.TBI_ENCRYPTION_IV,
        currency: (process.env.TBI_CURRENCY ?? defaultCurrency).trim().toUpperCase(),
        timeout_ms: Number(process.env.TBI_TIMEOUT_MS ?? 15000),
        webhook_secret: process.env.TBI_WEBHOOK_SECRET,
    };
};

export default registerAs("tbiCredit", TbiCreditConfig);
