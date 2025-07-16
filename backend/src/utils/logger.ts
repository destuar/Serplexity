/**
 * @file logger.ts
 * @description This file provides a simple logging utility that wraps the standard `console` methods.
 * It's a basic implementation that can be easily extended to integrate with more sophisticated logging systems
 * (e.g., Winston, Pino) in the future.
 *
 * @exports
 * - default: A simple logger object with `log`, `info`, `warn`, and `error` methods.
 */
const logger = {
  log: (...args: any[]) => {
    console.log(...args);
  },
  info: (...args: any[]) => {
    console.info(...args);
  },
  warn: (...args: any[]) => {
    console.warn(...args);
  },
  error: (...args: any[]) => {
    console.error(...args);
  },
};

export default logger; 