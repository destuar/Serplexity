/**
 * @file logfire.ts
 * @description Logfire configuration and instrumentation setup for Serplexity
 *
 * This module provides comprehensive observability for the Serplexity backend through
 * Logfire integration via OpenTelemetry. It instruments:
 * - PydanticAI agent executions and performance
 * - Multi-provider LLM health monitoring
 * - Express.js HTTP requests and responses
 * - Database operations and query performance
 * - Background job processing and queues
 * - Custom business metrics and events
 *
 * @features
 * - Automatic OpenTelemetry instrumentation to Logfire
 * - Custom span creation for business logic
 * - Performance monitoring with detailed metrics
 * - Error tracking and alerting
 * - Cost tracking across multiple LLM providers
 * - User session and company-specific tracking
 *
 * @dependencies
 * - @opentelemetry/*: OpenTelemetry instrumentation
 * - Express.js middleware integration
 * - Database connection monitoring
 *
 * @exports
 * - initializeLogfire: Setup function
 * - createSpan: Helper for custom spans
 * - trackLLMUsage: LLM cost tracking
 * - trackPerformance: Performance monitoring
 */

import { trace, context, SpanStatusCode, SpanKind, Span } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import express from "express";
import logger from "../utils/logger";

// --- Configuration Interface ---
export interface LogfireConfig {
  projectName: string;
  environment: string;
  serviceName: string;
  serviceVersion: string;
  enableAutoInstrumentation: boolean;
  enableCustomMetrics: boolean;
  enableErrorTracking: boolean;
  enablePerformanceMonitoring: boolean;
  samplingRate: number;
  debugMode: boolean;
}

// --- Default Configuration ---
const DEFAULT_CONFIG: LogfireConfig = {
  projectName: "serplexity-backend",
  environment: process.env.NODE_ENV || "development",
  serviceName: "serplexity-api",
  serviceVersion: process.env.npm_package_version || "1.0.0",
  enableAutoInstrumentation: true,
  enableCustomMetrics: true,
  enableErrorTracking: true,
  enablePerformanceMonitoring: true,
  samplingRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  debugMode: process.env.NODE_ENV === "development",
};

// --- Service State ---
let isInitialized = false;
let config: LogfireConfig;
let sdk: NodeSDK | null = null;
const tracer = trace.getTracer("serplexity-backend");

/**
 * Initialize Logfire with comprehensive instrumentation
 */
export async function initializeLogfire(
  customConfig?: Partial<LogfireConfig>,
): Promise<void> {
  if (isInitialized) {
    logger.warn("Logfire already initialized, skipping...");
    return;
  }

  try {
    config = { ...DEFAULT_CONFIG, ...customConfig };

    logger.info("Initializing Logfire observability", {
      projectName: config.projectName,
      environment: config.environment,
      serviceName: config.serviceName,
      samplingRate: config.samplingRate,
    });

    // Validate Logfire token
    const logfireToken = process.env.LOGFIRE_TOKEN;
    if (!logfireToken) {
      throw new Error("LOGFIRE_TOKEN environment variable is required");
    }

    // Set up environment variables for OpenTelemetry to send to Logfire
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT =
      "https://logfire-api.pydantic.dev/v1/traces";
    process.env.OTEL_EXPORTER_OTLP_HEADERS = `Authorization=Bearer ${logfireToken}`;
    process.env.OTEL_SERVICE_NAME = config.serviceName;
    process.env.OTEL_SERVICE_VERSION = config.serviceVersion;
    process.env.OTEL_RESOURCE_ATTRIBUTES = `service.name=${config.serviceName},service.version=${config.serviceVersion},deployment.environment=${config.environment}`;

    // Create OpenTelemetry SDK configuration
    if (config.enableAutoInstrumentation) {
      sdk = new NodeSDK({
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

      // Start the SDK
      sdk.start();
    }

    isInitialized = true;

    logger.info("Logfire initialization completed successfully", {
      projectName: config.projectName,
      instrumentationEnabled: config.enableAutoInstrumentation,
      metricsEnabled: config.enableCustomMetrics,
    });
  } catch (error) {
    logger.error("Failed to initialize Logfire", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error(
      `Logfire initialization failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Create custom span for business logic monitoring
 */
export function createSpan<T>(
  spanName: string,
  operation: (span: Span) => Promise<T> | T,
  attributes?: Record<string, unknown>,
  spanKind: SpanKind = SpanKind.INTERNAL,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const span = tracer.startSpan(spanName, {
      kind: spanKind,
      attributes: {
        "service.name": config?.serviceName || "serplexity-api",
        "service.version": config?.serviceVersion || "1.0.0",
        environment: config?.environment || "development",
        ...attributes,
      },
    });

    const activeContext = trace.setSpan(context.active(), span);

    context.with(activeContext, async () => {
      try {
        const result = await operation(span);
        span.setStatus({ code: SpanStatusCode.OK });
        resolve(result);
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        span.recordException(error as Error);
        reject(error);
      } finally {
        span.end();
      }
    });
  });
}

/**
 * Track LLM usage across multiple providers
 */
export function trackLLMUsage(
  provider: string,
  modelId: string,
  operation: string,
  tokensUsed: number,
  costEstimate?: number,
  duration?: number,
  success?: boolean,
  metadata?: Record<string, unknown>,
): void {
  const span = tracer.startSpan("llm.usage", {
    attributes: {
      "llm.provider": provider,
      "llm.model": modelId,
      "llm.operation": operation,
      "llm.tokens.total": tokensUsed,
      "llm.cost.estimate": costEstimate || 0,
      "llm.duration.ms": duration || 0,
      "llm.success": success !== false,
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  });

  logger.info("LLM Usage Tracked", {
    provider,
    modelId,
    operation,
    tokensUsed,
    costEstimate,
    duration,
    success,
    metadata,
  });

  span.end();
}

/**
 * Track performance metrics for critical operations
 */
export function trackPerformance(
  operationName: string,
  duration: number,
  success: boolean,
  metadata?: Record<string, unknown>,
): void {
  const span = tracer.startSpan("performance.metric", {
    attributes: {
      "performance.operation": operationName,
      "performance.duration.ms": duration,
      "performance.success": success,
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  });

  // Only log performance metrics if explicitly enabled
  if (process.env.LOG_PERFORMANCE_METRICS === "true") {
    logger.info("Performance Metric", {
      operationName,
      duration,
      success,
      metadata,
    });
  }

  span.end();
}

/**
 * Track business events and user actions
 */
export function trackBusinessEvent(
  eventName: string,
  userId?: string,
  companyId?: string,
  metadata?: Record<string, unknown>,
): void {
  const span = tracer.startSpan("business.event", {
    attributes: {
      "event.name": eventName,
      "user.id": userId || "",
      "company.id": companyId || "",
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  });

  logger.info("Business Event", {
    eventName,
    userId,
    companyId,
    metadata,
  });

  span.end();
}

/**
 * Track errors with enhanced context
 */
export function trackError(
  error: Error,
  context: string,
  userId?: string,
  companyId?: string,
  metadata?: Record<string, unknown>,
): void {
  const span = tracer.startSpan("error.tracked", {
    attributes: {
      "error.message": error.message,
      "error.context": context,
      "user.id": userId || "",
      "company.id": companyId || "",
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  });

  span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

  logger.error("Application Error", {
    message: error.message,
    stack: error.stack,
    context,
    userId,
    companyId,
    metadata,
  });

  span.end();
}

/**
 * Express.js middleware for automatic request tracking
 */
export function logfireMiddleware() {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const startTime = Date.now();
    const requestId =
      req.headers["x-request-id"] ||
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Add request ID to response headers
    res.setHeader("X-Request-ID", requestId);

    // Create span for this request
    const span = tracer.startSpan(
      `HTTP ${req.method} ${req.route?.path || req.url}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          "http.method": req.method,
          "http.url": req.url,
          "http.route": req.route?.path || req.url,
          "http.user_agent": req.get("User-Agent") || "",
          "http.request_id": requestId,
          "user.id": req.user?.id || "",
          "company.id": (req.user as unknown)?.companyId || "",
        },
      },
    );

    // Track response
    const originalSend = res.send;
    res.send = function (data: unknown) {
      const duration = Date.now() - startTime;

      span.setAttributes({
        "http.status_code": res.statusCode,
        "http.duration.ms": duration,
        "http.success": res.statusCode < 400,
      });

      span.setStatus({
        code: res.statusCode < 400 ? SpanStatusCode.OK : SpanStatusCode.ERROR,
      });

      logger.info("HTTP Request Completed", {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        requestId,
        duration,
        success: res.statusCode < 400,
        userId: req.user?.id,
        companyId: (req.user as unknown)?.companyId,
      });

      span.end();
      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Get current configuration
 */
export function getConfig(): LogfireConfig {
  return config;
}

/**
 * Check if Logfire is properly initialized
 */
export function isLogfireInitialized(): boolean {
  return isInitialized;
}

/**
 * Gracefully shutdown Logfire
 */
export async function shutdownLogfire(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    logger.info("Logfire SDK shutdown completed");
  }
}
