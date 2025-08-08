/**
 * Generic telemetry no-ops used to keep instrumentation call sites intact
 * without introducing any observability vendor dependency.
 *
 * This mirrors the old logfire-stubs API to avoid widespread edits.
 */

type SpanAttributes = Record<string, string | number | boolean>;
type SpanFunction<T = unknown> = (span?: unknown) => T | Promise<T>;

export const trackLLMUsage = (..._args: unknown[]): void => {
  // no-op
};

export const trackPerformance = (..._args: unknown[]): void => {
  // no-op
};

export const trackError = (..._args: unknown[]): void => {
  // no-op
};

export async function initializeTelemetry(
  _options?: Record<string, unknown>
): Promise<void> {
  // no-op
}

export const initializeLogfire = (
  _options?: Record<string, unknown>
): Promise<void> => {
  // Back-compat alias so existing init sites need not change
  return Promise.resolve();
};

export function createSpan<T>(
  _name: string,
  fn: SpanFunction<T>,
  _attributes?: SpanAttributes
): T | Promise<T> {
  return fn(null);
}
