/**
 * @file tracing.ts
 * @description This file initializes OpenTelemetry for distributed tracing with Logfire integration.
 * It configures the OTLP (OpenTelemetry Protocol) trace exporter to send data to Logfire when available,
 * and automatically instruments Node.js modules to capture comprehensive telemetry data.
 *
 * @dependencies
 * - @opentelemetry/sdk-node: The OpenTelemetry SDK for Node.js.
 * - @opentelemetry/exporter-trace-otlp-http: The OTLP trace exporter for sending data over HTTP.
 * - @opentelemetry/auto-instrumentations-node: A meta-package for automatic instrumentation of Node.js modules.
 * - @opentelemetry/resources: For resource configuration.
 *
 * @exports
 * - sdk: The initialized OpenTelemetry NodeSDK instance.
 */
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import logger from "../utils/logger";

// Configure tracing based on available observability platforms
const logfireToken = process.env.LOGFIRE_TOKEN;
const _environment = process.env.NODE_ENV || "development";

let traceExporter: OTLPTraceExporter;

if (logfireToken) {
  // Use Logfire as the primary observability backend
  logger.info("Configuring OpenTelemetry to send traces to Logfire");
  traceExporter = new OTLPTraceExporter({
    url: "https://logfire-api.pydantic.dev/v1/traces",
    headers: {
      Authorization: `Bearer ${logfireToken}`,
      "Content-Type": "application/json",
    },
  });
} else {
  // Fallback to local or custom OTLP endpoint
  logger.info("LOGFIRE_TOKEN not found, using fallback OTLP endpoint");
  traceExporter = new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
      "http://localhost:4318/v1/traces",
  });
}

const sdk = new NodeSDK({
  serviceName: "serplexity-backend",
  traceExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-express": {
        enabled: true,
      },
      "@opentelemetry/instrumentation-http": {
        enabled: true,
      },
      "@opentelemetry/instrumentation-redis": {
        enabled: true,
      },
    }),
  ],
});

// Temporarily disabled to remove logfire dependency
// try {
//   sdk.start();
//   logger.info("OpenTelemetry tracing initialized successfully");
// } catch (error) {
//   logger.error("Error initializing OpenTelemetry tracing", { error });
// }

process.on("SIGTERM", () => {
  sdk
    .shutdown()
    .then(() => logger.info("Tracing terminated"))
    .catch((error) => logger.error("Error terminating tracing", { error }))
    .finally(() => process.exit(0));
});

export default sdk;
