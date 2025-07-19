/**
 * @file redis.ts
 * @description This file implements a sophisticated Redis connection manager, designed for high availability and resilience.
 * It features a connection pool, a circuit breaker pattern to prevent cascading failures, and regular health checks to ensure
 * the stability of the Redis connections. It exports a singleton instance of the connection manager for use throughout the application.
 *
 * @dependencies
 * - ioredis: A robust, high-performance Redis client for Node.js.
 * - ./env: Environment variable configuration.
 * - ../utils/logger: Logger for application-level logging.
 *
 * @exports
 * - redis: A singleton Redis connection instance for general use.
 * - bullmqConnection: A dedicated Redis connection instance for BullMQ.
 * - checkRedisHealth: A function to perform a health check on the Redis connection pool.
 * - redisManager: The singleton instance of the RedisConnectionManager for advanced operations.
 */
import Redis, { RedisOptions } from "ioredis";
import env from "./env";
import logger from "../utils/logger";

// Connection pool configuration
const POOL_SIZE = 5;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute

// Circuit breaker state
enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

class RedisConnectionManager {
  private connections: Redis[] = [];
  private circuitState: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private healthCheckInterval?: NodeJS.Timeout;
  private isShuttingDown = false;
  private lastHealthyCount: number = POOL_SIZE;

  private readonly baseConfig: RedisOptions = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,

    // Production-optimized settings
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: true,
    showFriendlyErrorStack: env.NODE_ENV !== "production",

    // Conservative connection settings
    connectTimeout: 10000,
    lazyConnect: true, // Don't connect immediately

    // Retry strategy with exponential backoff
    retryStrategy: (times: number) => {
      if (times > MAX_RETRIES) return null;
      const delay = Math.min(times * RETRY_DELAY_MS, 5000);
      logger.warn(`[Redis] Retry attempt ${times}, delay ${delay}ms`);
      return delay;
    },

    // Keep-alive and TCP settings
    keepAlive: 30000,
    family: 4, // Force IPv4

    // TLS configuration
    tls: env.REDIS_USE_TLS
      ? {
          servername: env.REDIS_HOST,
          rejectUnauthorized: false,
        }
      : undefined,
  };

  constructor() {
    this.initializeConnections();
    this.startHealthCheck();
    this.setupGracefulShutdown();
  }

  private initializeConnections(): void {
    logger.info(
      `[Redis] Initializing connection pool with ${POOL_SIZE} connections`,
    );

    for (let i = 0; i < POOL_SIZE; i++) {
      const connection = new Redis(this.baseConfig);
      this.setupConnectionHandlers(connection, i);
      this.connections.push(connection);
    }
  }

  private setupConnectionHandlers(connection: Redis, index: number): void {
    connection.on("connect", () => {
      logger.info(`[Redis:${index}] Connected`);
      this.onConnectionSuccess();
    });

    connection.on("ready", () => {
      logger.info(`[Redis:${index}] Ready`);
    });

    connection.on("error", (err) => {
      logger.error(`[Redis:${index}] Error: ${err.message}`);
      this.onConnectionError(err);
    });

    connection.on("close", () => {
      logger.warn(`[Redis:${index}] Connection closed`);
    });

    connection.on("reconnecting", () => {
      logger.info(`[Redis:${index}] Reconnecting...`);
    });
  }

  private onConnectionSuccess(): void {
    if (this.circuitState === CircuitState.HALF_OPEN) {
      logger.info("[Redis] Circuit breaker: HALF_OPEN -> CLOSED");
      this.circuitState = CircuitState.CLOSED;
      this.failureCount = 0;
    }
  }

  private onConnectionError(error: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (
      this.failureCount >= CIRCUIT_BREAKER_THRESHOLD &&
      this.circuitState === CircuitState.CLOSED
    ) {
      logger.error("[Redis] Circuit breaker: CLOSED -> OPEN");
      this.circuitState = CircuitState.OPEN;

      // Schedule circuit breaker reset
      setTimeout(() => {
        if (this.circuitState === CircuitState.OPEN) {
          logger.info("[Redis] Circuit breaker: OPEN -> HALF_OPEN");
          this.circuitState = CircuitState.HALF_OPEN;
          this.failureCount = 0;
        }
      }, CIRCUIT_BREAKER_TIMEOUT);
    }
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      if (this.isShuttingDown) return;

      try {
        const healthyConnections = await this.checkConnectionHealth();

        // Only log if the health status changes or not fully healthy
        if (healthyConnections !== this.lastHealthyCount) {
          if (healthyConnections < POOL_SIZE) {
            logger.warn(
              `[Redis] Health check: ${healthyConnections}/${POOL_SIZE} connections healthy`,
            );
          } else {
            logger.info(
              `[Redis] Health check: all ${POOL_SIZE} connections healthy`,
            );
          }
          this.lastHealthyCount = healthyConnections;
        }

        if (healthyConnections === 0) {
          logger.error(
            "[Redis] All connections unhealthy, attempting recovery",
          );
          await this.recoverConnections();
        }
      } catch (error) {
        logger.error("[Redis] Health check failed:", error);
      }
    }, HEALTH_CHECK_INTERVAL);
  }

  private async checkConnectionHealth(): Promise<number> {
    let healthyCount = 0;

    for (const connection of this.connections) {
      try {
        if (connection.status === "ready") {
          await connection.ping();
          healthyCount++;
        }
      } catch (error) {
        // Connection is unhealthy, skip
      }
    }

    return healthyCount;
  }

  private async recoverConnections(): Promise<void> {
    logger.info("[Redis] Starting connection recovery");

    for (let i = 0; i < this.connections.length; i++) {
      const connection = this.connections[i];

      if (connection.status !== "ready") {
        try {
          await connection.connect();
          logger.info(`[Redis:${i}] Recovered connection`);
        } catch (error) {
          logger.error(`[Redis:${i}] Recovery failed: ${error}`);
        }
      }
    }
  }

  public getConnection(): Redis {
    if (this.circuitState === CircuitState.OPEN) {
      throw new Error(
        "Redis circuit breaker is OPEN - service temporarily unavailable",
      );
    }

    // Find a healthy connection
    for (const connection of this.connections) {
      if (connection.status === "ready") {
        return connection;
      }
    }

    // If no ready connections, try to use any available connection
    const availableConnection = this.connections.find(
      (c) => c.status !== "end",
    );
    if (availableConnection) {
      return availableConnection;
    }

    throw new Error("No Redis connections available");
  }

  public async ping(): Promise<string> {
    const connection = this.getConnection();
    return await connection.ping();
  }

  public async healthCheck(): Promise<{
    status: string;
    latency?: number;
    error?: string;
    poolStatus: any;
  }> {
    try {
      const start = Date.now();
      await this.ping();
      const latency = Date.now() - start;

      const poolStatus = {
        totalConnections: this.connections.length,
        readyConnections: this.connections.filter((c) => c.status === "ready")
          .length,
        circuitState: this.circuitState,
        failureCount: this.failureCount,
      };

      return { status: "healthy", latency, poolStatus };
    } catch (error) {
      const poolStatus = {
        totalConnections: this.connections.length,
        readyConnections: 0,
        circuitState: this.circuitState,
        failureCount: this.failureCount,
      };

      return {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
        poolStatus,
      };
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      logger.info("[Redis] Starting graceful shutdown");
      this.isShuttingDown = true;

      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Close all connections
      await Promise.all(
        this.connections.map(async (connection, index) => {
          try {
            await connection.quit();
            logger.info(`[Redis:${index}] Connection closed gracefully`);
          } catch (error) {
            logger.error(`[Redis:${index}] Error during shutdown: ${error}`);
          }
        }),
      );

      logger.info("[Redis] Shutdown complete");
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  }
}

// Create singleton instance
const redisManager = new RedisConnectionManager();

// Export the main connection and BullMQ connection
export const redis = redisManager.getConnection();
export const bullmqConnection = redisManager.getConnection();

// Export health check function
export const checkRedisHealth = () => redisManager.healthCheck();

// Export manager for advanced operations
export { redisManager };
