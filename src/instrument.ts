// Import with `const Sentry = require("@sentry/nestjs");` if you are using CJS
import * as Sentry from "@sentry/nestjs"

// This file runs before ConfigModule, so .env has to be loaded here for SENTRY_DSN to be visible
try {
  process.loadEnvFile();
} catch {
  // No .env file: the environment is provided by the process manager or container
}

const sentryDsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  environment: process.env.NODE_ENV ?? "development",
  release: process.env.SENTRY_RELEASE,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),

  // Send structured logs to Sentry
  enableLogs: true,
  enableMetrics: true,
  dataCollection: {
    // Request bodies carry passwords, OTPs, and addresses. The exception filter attaches a
    // sanitized copy to reported errors instead.
    httpBodies: [],
  },
});
