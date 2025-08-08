/**
 * @file tracing.ts
 * @description This file initializes OpenTelemetry for distributed tracing with a generic OTLP exporter.
 * It configures the OTLP (OpenTelemetry Protocol) trace exporter to send data to a configured endpoint when available,
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
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import logger from "../utils/logger";

// Configure tracing based on available observability platforms
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
const _environment = process.env.NODE_ENV || "development";

const traceExporter: OTLPTraceExporter = new OTLPTraceExporter({
  url: otlpEndpoint || "http://localhost:4318/v1/traces",
});

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

// Initialization disabled by default; opt-in where needed
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
