// Import with `const Sentry = require("@sentry/nestjs");` if you are using CJS
import * as Sentry from "@sentry/nestjs"

const sentryDsn = process.env.SENTRY_DSN
  ?? "https://c903c941a66db8f6ea446306fa925be6@o4511761342988288.ingest.us.sentry.io/4511761346265088";

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
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/node/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});

Sentry.metrics.count('button_click', 1);
Sentry.metrics.gauge('page_load_time', 150);
Sentry.metrics.distribution('response_time', 200);
