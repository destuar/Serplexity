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

// Connection pool configuration - Optimized for stability
const POOL_SIZE = 5;
const MAX_RETRIES = 5; // More retries for unstable networks
const RETRY_DELAY_MS = 2000; // Longer retry delay
const HEALTH_CHECK_INTERVAL = 60000; // 60 seconds - less aggressive
const CIRCUIT_BREAKER_THRESHOLD = 10; // Higher threshold before opening circuit
const CIRCUIT_BREAKER_TIMEOUT = 120000; // 2 minutes - longer recovery time
const MAINTENANCE_INTERVAL = 3600000; // 1 hour - cleanup old data
const MAX_QUEUE_AGE_HOURS = 24; // Remove queue data older than 24 hours

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
  private maintenanceInterval?: NodeJS.Timeout;
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

    // More generous connection settings for unstable networks and high-latency Redis Cloud
    connectTimeout: 60000, // 60 seconds - extended for Redis Cloud
    commandTimeout: 90000, // 90 seconds for commands - extended for Redis Cloud BullMQ operations
    lazyConnect: true, // Don't connect immediately

    // Retry strategy with exponential backoff
    retryStrategy: (times: number) => {
      if (times > MAX_RETRIES) return null;
      const delay = Math.min(times * RETRY_DELAY_MS, 10000); // Up to 10 seconds
      logger.warn(`[Redis] Retry attempt ${times}, delay ${delay}ms`);
      return delay;
    },

    // Keep-alive and TCP settings - more resilient
    keepAlive: 60000, // 60 seconds keep-alive
    family: 4, // Force IPv4
    
    // Additional stability settings
    enableOfflineQueue: true, // Queue commands when disconnected
    // maxLoadingTimeout: 10000, // 10 seconds for LOADING responses - not available in this Redis version
    
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
    this.startMaintenanceTask();
  }

  private initializeConnections(): void {
    logger.info(
      `[Redis] Initializing connection pool with ${POOL_SIZE} connections`,
    );

    for (let i = 0; i < POOL_SIZE; i++) {
      const connection = new Redis({
        ...this.baseConfig,
        // Add unique connection name for debugging
        connectionName: `serplexity-conn-${i}`,
      });
      this.setupConnectionHandlers(connection, i);
      this.connections.push(connection);
      
      // Force immediate connection attempt
      connection.connect().catch((err) => {
        logger.warn(`[Redis:${i}] Initial connection failed: ${err.message}`);
      });
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

        // Only log if the health status changes significantly
        if (healthyConnections !== this.lastHealthyCount) {
          if (healthyConnections === 0) {
            logger.error(
              `[Redis] Health check: ALL connections unhealthy`,
            );
          } else if (healthyConnections < POOL_SIZE / 2) {
            logger.warn(
              `[Redis] Health check: ${healthyConnections}/${POOL_SIZE} connections healthy`,
            );
          } else if (healthyConnections === POOL_SIZE && this.lastHealthyCount < POOL_SIZE) {
            logger.info(
              `[Redis] Health check: all ${POOL_SIZE} connections recovered`,
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

  private startMaintenanceTask(): void {
    this.maintenanceInterval = setInterval(async () => {
      if (this.isShuttingDown) return;

      try {
        await this.performMaintenance();
      } catch (error) {
        logger.error("[Redis] Maintenance task failed:", error);
      }
    }, MAINTENANCE_INTERVAL);

    // Run initial maintenance after 5 minutes
    setTimeout(() => {
      if (!this.isShuttingDown) {
        this.performMaintenance().catch((error) => {
          logger.error("[Redis] Initial maintenance failed:", error);
        });
      }
    }, 300000);
  }

  private async performMaintenance(): Promise<void> {
    logger.info("[Redis] Starting maintenance task");
    
    try {
      const connection = this.getConnection();
      
      // 1. Clean up old BullMQ job data
      await this.cleanupOldJobs(connection);
      
      // 2. Clean up expired keys
      await this.cleanupExpiredKeys(connection);
      
      // 3. Check memory usage
      await this.checkMemoryUsage(connection);
      
      // 4. Optimize connection pool
      await this.optimizeConnectionPool();
      
      logger.info("[Redis] Maintenance task completed successfully");
    } catch (error) {
      logger.error("[Redis] Maintenance task failed:", error);
    }
  }

  private async cleanupOldJobs(connection: Redis): Promise<void> {
    try {
      const queuePrefix = env.BULLMQ_QUEUE_PREFIX || "bull";
      const cutoffTime = Date.now() - (MAX_QUEUE_AGE_HOURS * 60 * 60 * 1000);
      
      // Get all queue keys
      const queueKeys = await connection.keys(`${queuePrefix}:*:completed`);
      const failedKeys = await connection.keys(`${queuePrefix}:*:failed`);
      
      let cleanedJobs = 0;
      let skippedKeys = 0;
      
      // Clean completed jobs older than cutoff
      for (const key of [...queueKeys, ...failedKeys]) {
        try {
          // Filter out non-standard queue keys (must follow pattern: prefix:queue:status)
          const keyParts = key.split(':');
          if (keyParts.length !== 3 || !keyParts[1] || !['completed', 'failed'].includes(keyParts[2])) {
            skippedKeys++;
            continue;
          }

          // Validate key type before zrangebyscore operation
          const keyType = await connection.type(key);
          if (keyType !== 'zset') {
            logger.debug(`[Redis] Skipping key ${key} - expected zset, got ${keyType}`);
            skippedKeys++;
            continue;
          }

          const jobs = await connection.zrangebyscore(key, 0, cutoffTime);
          if (jobs.length > 0) {
            await connection.zremrangebyscore(key, 0, cutoffTime);
            cleanedJobs += jobs.length;
          }
        } catch (keyError) {
          logger.warn(`[Redis] Failed to cleanup key ${key}:`, keyError);
          skippedKeys++;
        }
      }
      
      if (cleanedJobs > 0 || skippedKeys > 0) {
        logger.info(`[Redis] Cleaned up ${cleanedJobs} old queue jobs, skipped ${skippedKeys} invalid keys`);
      }
    } catch (error) {
      logger.warn("[Redis] Failed to cleanup old jobs:", error);
    }
  }

  private async cleanupExpiredKeys(connection: Redis): Promise<void> {
    try {
      // Get keys that might be expired or stale
      const stalePatterns = [
        "cache:*",
        "session:*", 
        "temp:*",
        "lock:*"
      ];
      
      let expiredKeys = 0;
      
      for (const pattern of stalePatterns) {
        const keys = await connection.keys(pattern);
        
        for (const key of keys) {
          const ttl = await connection.ttl(key);
          // If key has no TTL but should expire, set a reasonable TTL
          if (ttl === -1 && (key.includes("temp:") || key.includes("lock:"))) {
            await connection.expire(key, 3600); // 1 hour
            expiredKeys++;
          }
        }
      }
      
      if (expiredKeys > 0) {
        logger.info(`[Redis] Set TTL on ${expiredKeys} stale keys`);
      }
    } catch (error) {
      logger.warn("[Redis] Failed to cleanup expired keys:", error);
    }
  }

  private async checkMemoryUsage(connection: Redis): Promise<void> {
    try {
      const info = await connection.info("memory");
      const memoryLines = info.split("\r\n");
      
      let usedMemory = 0;
      let maxMemory = 0;
      
      for (const line of memoryLines) {
        if (line.startsWith("used_memory:")) {
          usedMemory = parseInt(line.split(":")[1]);
        }
        if (line.startsWith("maxmemory:")) {
          maxMemory = parseInt(line.split(":")[1]);
        }
      }
      
      if (maxMemory > 0) {
        const usagePercent = (usedMemory / maxMemory) * 100;
        
        if (usagePercent > 80) {
          logger.warn(`[Redis] High memory usage: ${usagePercent.toFixed(1)}%`);
        } else {
          logger.info(`[Redis] Memory usage: ${usagePercent.toFixed(1)}%`);
        }
      }
    } catch (error) {
      logger.warn("[Redis] Failed to check memory usage:", error);
    }
  }

  private async optimizeConnectionPool(): Promise<void> {
    try {
      // Check if we have dead connections and recreate them
      const deadConnections: number[] = [];
      
      for (let i = 0; i < this.connections.length; i++) {
        const connection = this.connections[i];
        if (connection.status === "end" || connection.status === "close") {
          deadConnections.push(i);
        }
      }
      
      if (deadConnections.length > 0) {
        logger.info(`[Redis] Recreating ${deadConnections.length} dead connections`);
        
        for (const index of deadConnections) {
          // Close the dead connection properly
          try {
            await this.connections[index].quit();
          } catch (error) {
            // Ignore errors when closing dead connections
          }
          
          // Create new connection
          const newConnection = new Redis({
            ...this.baseConfig,
            connectionName: `serplexity-conn-${index}-recreated`,
          });
          
          this.setupConnectionHandlers(newConnection, index);
          this.connections[index] = newConnection;
          
          // Force connection
          newConnection.connect().catch((err) => {
            logger.warn(`[Redis:${index}] Recreated connection failed: ${err.message}`);
          });
        }
      }
    } catch (error) {
      logger.warn("[Redis] Failed to optimize connection pool:", error);
    }
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
      
      if (this.maintenanceInterval) {
        clearInterval(this.maintenanceInterval);
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
