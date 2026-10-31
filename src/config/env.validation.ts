import { Logger } from "@nestjs/common";

const MIN_JWT_SECRET_LENGTH = 32;
const KNOWN_WEAK_JWT_SECRETS = ["MySecret", "change-me-in-production", "secret"];

type Env = Record<string, unknown>;

const isSet = (env: Env, key: string) => String(env[key] ?? "").trim().length > 0;
const isEnabled = (env: Env, key: string) => String(env[key] ?? "").trim() === "true";

function collectProblems(env: Env) {
    const errors: string[] = [];
    const warnings: string[] = [];

    const requireKeys = (keys: string[], reason?: string) => {
        for (const key of keys) {
            if (!isSet(env, key)) {
                errors.push(`${key} is required${reason ? ` ${reason}` : ""}.`);
            }
        }
    };

    if (!isSet(env, "DATABASE_URL") && !isSet(env, "DB_HOST")) {
        errors.push("DATABASE_URL (or DB_HOST, DB_USER, DB_PASSWORD, DB_NAME) is required.");
    }

    requireKeys(["JWT_SECRET", "STRIPE_KEY", "STRIPE_WEBHOOK", "CORS_ORIGINS", "APP_URL"]);
    requireKeys(["MAILER_HOST", "MAILER_PORT", "MAILER_MAIL", "MAILER_PASSWORD"], "for OTP and account emails");

    const jwtSecret = String(env.JWT_SECRET ?? "");
    if (jwtSecret && (jwtSecret.length < MIN_JWT_SECRET_LENGTH || KNOWN_WEAK_JWT_SECRETS.includes(jwtSecret))) {
        errors.push(`JWT_SECRET must be a random value of at least ${MIN_JWT_SECRET_LENGTH} characters.`);
    }

    const corsOrigins = String(env.CORS_ORIGINS ?? "");
    if (corsOrigins.includes("*")) {
        errors.push("CORS_ORIGINS must list explicit origins, not a wildcard.");
    }

    if (String(env.STRIPE_KEY ?? "").startsWith("sk_test_")) {
        warnings.push("STRIPE_KEY is a Stripe test key: no real payments will be taken.");
    }

    if (isEnabled(env, "TBI_ENABLED")) {
        requireKeys(["TBI_BASE_URL", "TBI_RESELLER_CODE", "TBI_RESELLER_KEY", "TBI_ENCRYPTION_KEY"], "when TBI_ENABLED=true");
        if (!isSet(env, "SWAGGER_SERVER_URL") && !isSet(env, "API_PUBLIC_URL")) {
            errors.push("API_PUBLIC_URL is required when TBI_ENABLED=true, so TBI can reach the status webhook.");
        }
        if (/beta\.tbibank|tbi-uat/i.test(String(env.TBI_BASE_URL ?? ""))) {
            warnings.push("TBI_BASE_URL points at a TBI test environment.");
        }
    }

    if (isEnabled(env, "LEGITGRAILS_ENABLED")) {
        requireKeys(["LEGITGRAILS_API_KEY", "LEGITGRAILS_WEBHOOK_SIGNING_SECRET"], "when LEGITGRAILS_ENABLED=true");
        if (isEnabled(env, "LEGITGRAILS_TEST_MODE")) {
            warnings.push("LEGITGRAILS_TEST_MODE=true: products are verified by mock outcomes, not real authenticators.");
        }
    }

    return { errors, warnings };
}

/**
 * Passed to ConfigModule so a misconfigured production deployment refuses to boot,
 * rather than starting and failing open (forgeable tokens, unsigned webhooks, open CORS).
 */
export function validateEnv(env: Env) {
    if (env.NODE_ENV !== "production") {
        return env;
    }

    const { errors, warnings } = collectProblems(env);
    const logger = new Logger("EnvValidation");
    warnings.forEach((warning) => logger.warn(warning));

    if (errors.length) {
        throw new Error(`Invalid production configuration:\n- ${errors.join("\n- ")}`);
    }

    return env;
}
