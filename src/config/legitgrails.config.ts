import { registerAs } from "@nestjs/config";

export const LegitGrailsConfig = () => ({
    enabled: process.env.LEGITGRAILS_ENABLED === "true",
    api_url: process.env.LEGITGRAILS_API_URL,
    api_key: process.env.LEGITGRAILS_API_KEY,
    submit_path: process.env.LEGITGRAILS_SUBMIT_PATH ?? "/authentications",
    status_path: process.env.LEGITGRAILS_STATUS_PATH ?? "/authentications/:id",
    webhook_secret: process.env.LEGITGRAILS_WEBHOOK_SECRET,
    timeout_ms: Number(process.env.LEGITGRAILS_TIMEOUT_MS ?? 15000),
});

export default registerAs("legitgrails", LegitGrailsConfig);
