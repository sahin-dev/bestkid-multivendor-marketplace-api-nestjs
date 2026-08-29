import { registerAs } from "@nestjs/config";

export const LegitGrailsConfig = () => ({
    enabled: process.env.LEGITGRAILS_ENABLED === "true",
    base_url: process.env.LEGITGRAILS_BASE_URL ?? "https://api.legitgrails.com/v1/integrations",
    api_key: process.env.LEGITGRAILS_API_KEY,
    // The API key's environment (Live vs Test) is not discoverable from the API itself, so we
    // track it ourselves: Test keys must send `mock_outcome` on order creation, Live keys must omit it.
    test_mode: process.env.LEGITGRAILS_TEST_MODE === "true",
    // The signing_secret returned once when the webhook endpoint was registered via POST /webhooks.
    webhook_signing_secret: process.env.LEGITGRAILS_WEBHOOK_SIGNING_SECRET,
    // Reject webhook deliveries whose X-LG-Timestamp is older than this, to bound replay risk.
    webhook_max_clock_skew_seconds: Number(process.env.LEGITGRAILS_WEBHOOK_MAX_CLOCK_SKEW_SECONDS ?? 300),
    timeout_ms: Number(process.env.LEGITGRAILS_TIMEOUT_MS ?? 15000),
});

export default registerAs("legitgrails", LegitGrailsConfig);
