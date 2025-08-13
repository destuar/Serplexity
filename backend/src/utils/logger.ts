/**
 * @file logger.ts
 * @description Enhanced logging utility with better formatting and level control
 */

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const getCurrentLogLevel = (): LogLevel => {
  const level = process.env["LOG_LEVEL"]?.toUpperCase();
  switch (level) {
    case "DEBUG":
      return LogLevel.DEBUG;
    case "INFO":
      return LogLevel.INFO;
    case "WARN":
      return LogLevel.WARN;
    case "ERROR":
      return LogLevel.ERROR;
    default:
      return LogLevel.INFO;
  }
};

const formatMessage = (
  level: string,
  message: string,
  context?: unknown
): string => {
  const timestamp = new Date().toISOString();
  let formatted = `[${timestamp}] [${level}] ${message}`;

  try {
    if (context && typeof context === "object") {
      const entries = Object.entries(context as Record<string, unknown>);
      if (entries.length > 0) {
        const cleanContext = Object.fromEntries(
          entries.filter(
            ([, value]) => value !== undefined && value !== null && value !== ""
          )
        );
        if (Object.keys(cleanContext).length > 0) {
          formatted += ` | ${JSON.stringify(cleanContext)}`;
        }
      }
    }
  } catch {
    // ignore context formatting errors
  }

  return formatted;
};

const logger = {
  log: (...args: unknown[]) => {
    console.log(...args);
  },
  info: (message: string, context?: unknown) => {
    if (getCurrentLogLevel() <= LogLevel.INFO) {
      console.info(formatMessage("INFO", message, context));
    }
  },
  warn: (message: string, context?: unknown) => {
    if (getCurrentLogLevel() <= LogLevel.WARN) {
      console.warn(formatMessage("WARN", message, context));
    }
  },
  error: (message: string, context?: unknown) => {
    if (getCurrentLogLevel() <= LogLevel.ERROR) {
      console.error(formatMessage("ERROR", message, context));
    }
  },
  debug: (message: string, context?: unknown) => {
    if (getCurrentLogLevel() <= LogLevel.DEBUG) {
      console.debug(formatMessage("DEBUG", message, context));
    }
  },
};

export default logger;
