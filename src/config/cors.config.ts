const DEVELOPMENT_ORIGINS = ["http://localhost:2005", "http://localhost:2006"];
const PRODUCTION_ORIGINS = ["https://bestkid.eu"];

let allowedOrigins: Set<string> | undefined;

function getAllowedOrigins() {
    if (!allowedOrigins) {
        const configured = (process.env.CORS_ORIGINS ?? "")
            .split(",")
            .map((origin) => origin.trim().replace(/\/+$/, ""))
            .filter(Boolean);

        allowedOrigins = new Set(
            process.env.NODE_ENV === "production"
                ? [...configured, ...PRODUCTION_ORIGINS]
                : [...configured, ...DEVELOPMENT_ORIGINS],
        );
    }

    return allowedOrigins;
}

/**
 * Shared by the HTTP server and the Socket.IO gateway. Requests without an Origin header
 * (mobile apps, server-to-server webhooks) are not subject to CORS and pass through.
 */
export function corsOriginDelegate(
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void,
) {
    callback(null, !origin || getAllowedOrigins().has(origin));
}
