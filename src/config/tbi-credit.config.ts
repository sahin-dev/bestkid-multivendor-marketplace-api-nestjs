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
        currency: (process.env.TBI_CURRENCY ?? defaultCurrency).trim().toUpperCase(),
        timeout_ms: Number(process.env.TBI_TIMEOUT_MS ?? 15000),
        webhook_secret: process.env.TBI_WEBHOOK_SECRET,
        // A bank decision can take days, so the items stay held far longer than for a card payment
        reservation_minutes: Number(process.env.TBI_RESERVATION_MINUTES ?? 48 * 60),
    };
};

export default registerAs("tbiCredit", TbiCreditConfig);
