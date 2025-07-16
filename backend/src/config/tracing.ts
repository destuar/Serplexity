/**
 * @file tracing.ts
 * @description This file initializes OpenTelemetry for distributed tracing. It configures the OTLP (OpenTelemetry Protocol)
 * trace exporter and automatically instruments Node.js modules to capture telemetry data. This is crucial for monitoring,
 * debugging, and performance analysis in a microservices or distributed environment.
 *
 * @dependencies
 * - @opentelemetry/sdk-node: The OpenTelemetry SDK for Node.js.
 * - @opentelemetry/exporter-trace-otlp-http: The OTLP trace exporter for sending data over HTTP.
 * - @opentelemetry/auto-instrumentations-node: A meta-package for automatic instrumentation of Node.js modules.
 *
 * @exports
 * - sdk: The initialized OpenTelemetry NodeSDK instance.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
});

const sdk = new NodeSDK({
  serviceName: 'serplexity-backend',
  traceExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

try {
  sdk.start();
  console.log('OpenTelemetry tracing initialized successfully.');
} catch (error) {
  console.error('Error initializing OpenTelemetry tracing', error);
}

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.error('Error terminating tracing', error))
    .finally(() => process.exit(0));
});

export default sdk; 