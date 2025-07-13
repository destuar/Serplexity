import Redis from 'ioredis';
import env from './env';
import logger from '../utils/logger';

/**
 * Redis connection pool manager to prevent connection exhaustion
 * Shares connections between different services
 */
class RedisConnectionPool {
  private static instance: RedisConnectionPool;
  private mainConnection: Redis | null = null;
  private bullmqConnection: Redis | null = null;
  private healthCheckConnection: Redis | null = null;
  private connectionCount = 0;
  private maxConnections = 5; // Conservative limit
  
  // Circuit breaker state
  private circuitBreakerOpen = false;
  private circuitBreakerOpenTime = 0;
  private circuitBreakerTimeout = 60000; // 1 minute
  private consecutiveFailures = 0;
  private maxConsecutiveFailures = 5;

  private constructor() {}

  static getInstance(): RedisConnectionPool {
    if (!RedisConnectionPool.instance) {
      RedisConnectionPool.instance = new RedisConnectionPool();
    }
    return RedisConnectionPool.instance;
  }

  private createBaseConfig() {
    const config: any = {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      lazyConnect: true,
      connectTimeout: 20000, // Increased from 10s to 20s
      commandTimeout: 15000,  // Increased from 5s to 15s
      enableReadyCheck: true,
      retryDelayOnClusterDown: 1000, // Increased from 300ms
      maxRetriesPerRequest: null, // Required by BullMQ
      // Enhanced retry policy with exponential backoff
      retryPolicy: (times: number) => {
        const delay = Math.min(times * 100, 5000); // Increased backoff
        return delay;
      },
      // Add keep-alive settings
      keepAlive: 30000,
      family: 4, // Force IPv4
      // Add reconnection settings
      enableOfflineQueue: true,
      maxLoadingTimeout: 60000,
    };

    if (env.REDIS_PASSWORD) {
      config.password = env.REDIS_PASSWORD;
    }

    if (env.REDIS_USE_TLS) {
      config.tls = {
        servername: env.REDIS_HOST,
        rejectUnauthorized: false,
      };
    }

    return config;
  }

  /**
   * Get main Redis connection for general use
   */
  getMainConnection(): Redis {
    if (!this.mainConnection) {
      if (this.connectionCount >= this.maxConnections) {
        logger.warn(`[RedisPool] Connection limit reached (${this.maxConnections}), reusing main connection`);
        return this.mainConnection || this.createConnection('main');
      }
      
      this.mainConnection = this.createConnection('main');
      this.connectionCount++;
    }
    return this.mainConnection;
  }

  /**
   * Get Redis connection optimized for BullMQ
   */
  getBullMQConnection(): Redis {
    if (!this.bullmqConnection) {
      if (this.connectionCount >= this.maxConnections) {
        logger.warn(`[RedisPool] Connection limit reached, reusing BullMQ connection`);
        return this.bullmqConnection || this.getMainConnection();
      }

      const config = this.createBaseConfig();
      // BullMQ specific optimizations
      config.maxRetriesPerRequest = null;
      config.enableAutoPipelining = true;
      config.lazyConnect = false; // BullMQ needs immediate connection
      
      this.bullmqConnection = new Redis(config);
      this.setupConnectionEvents(this.bullmqConnection, 'bullmq');
      this.connectionCount++;
    }
    return this.bullmqConnection;
  }

  /**
   * Get Redis connection for health checks (lightweight)
   */
  getHealthCheckConnection(): Redis {
    if (!this.healthCheckConnection) {
      if (this.connectionCount >= this.maxConnections) {
        logger.warn(`[RedisPool] Connection limit reached, reusing health check connection`);
        return this.healthCheckConnection || this.getMainConnection();
      }

      const config = this.createBaseConfig();
      // Health check specific optimizations
      config.connectTimeout = 5000; // Faster timeout for health checks
      config.commandTimeout = 3000;
      
      this.healthCheckConnection = new Redis(config);
      this.setupConnectionEvents(this.healthCheckConnection, 'health');
      this.connectionCount++;
    }
    return this.healthCheckConnection;
  }

  private createConnection(type: string): Redis {
    const config = this.createBaseConfig();
    const connection = new Redis(config);
    this.setupConnectionEvents(connection, type);
    return connection;
  }

  private setupConnectionEvents(connection: Redis, type: string) {
    connection.on('connect', () => {
      logger.info(`[RedisPool:${type}] Connected to ${env.REDIS_HOST}:${env.REDIS_PORT}`);
      // Reset circuit breaker on successful connection
      this.consecutiveFailures = 0;
      this.circuitBreakerOpen = false;
    });

    connection.on('ready', () => {
      logger.info(`[RedisPool:${type}] Connection ready`);
      // Reset circuit breaker on ready state
      this.consecutiveFailures = 0;
      this.circuitBreakerOpen = false;
    });

    connection.on('error', (err) => {
      logger.error(`[RedisPool:${type}] Connection error:`, err.message);
      
      // Update circuit breaker state
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
        this.circuitBreakerOpen = true;
        this.circuitBreakerOpenTime = Date.now();
        logger.error(`[RedisPool:${type}] Circuit breaker OPENED after ${this.consecutiveFailures} failures`);
      }
      
      // If connection error, mark for recreation
      if (type === 'main') this.mainConnection = null;
      if (type === 'bullmq') this.bullmqConnection = null;
      if (type === 'health') this.healthCheckConnection = null;
      this.connectionCount = Math.max(0, this.connectionCount - 1);
    });

    connection.on('close', () => {
      logger.warn(`[RedisPool:${type}] Connection closed`);
    });

    connection.on('reconnecting', (ms: number) => {
      logger.info(`[RedisPool:${type}] Reconnecting in ${ms}ms...`);
    });
  }

  /**
   * Gracefully close all connections
   */
  async closeAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    if (this.mainConnection) {
      promises.push(this.mainConnection.quit().then(() => {}).catch(() => {}));
    }
    if (this.bullmqConnection) {
      promises.push(this.bullmqConnection.quit().then(() => {}).catch(() => {}));
    }
    if (this.healthCheckConnection) {
      promises.push(this.healthCheckConnection.quit().then(() => {}).catch(() => {}));
    }

    await Promise.all(promises);
    
    this.mainConnection = null;
    this.bullmqConnection = null;
    this.healthCheckConnection = null;
    this.connectionCount = 0;
    
    logger.info('[RedisPool] All connections closed');
  }

  /**
   * Check if circuit breaker allows connections
   */
  private isCircuitBreakerOpen(): boolean {
    if (!this.circuitBreakerOpen) return false;
    
    // Check if timeout has passed
    if (Date.now() - this.circuitBreakerOpenTime > this.circuitBreakerTimeout) {
      logger.info('[RedisPool] Circuit breaker timeout passed, attempting to close');
      this.circuitBreakerOpen = false;
      this.consecutiveFailures = Math.max(0, this.consecutiveFailures - 1);
      return false;
    }
    
    return true;
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      connectionCount: this.connectionCount,
      maxConnections: this.maxConnections,
      circuitBreakerOpen: this.circuitBreakerOpen,
      consecutiveFailures: this.consecutiveFailures,
      connections: {
        main: !!this.mainConnection,
        bullmq: !!this.bullmqConnection,
        health: !!this.healthCheckConnection
      }
    };
  }
}

// Export singleton instance and connections
const redisPool = RedisConnectionPool.getInstance();

// Main Redis connection for general use
export const redis = redisPool.getMainConnection();

// Timeout wrapper for Redis operations
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

// Health check function using pooled connection with timeout protection
export const checkRedisHealth = async (): Promise<{ 
  isHealthy: boolean; 
  details: Record<string, any> 
}> => {
  const stats = redisPool.getStats();
  
  // If circuit breaker is open, don't attempt connection
  if (stats.circuitBreakerOpen) {
    return {
      isHealthy: false,
      details: {
        error: 'Circuit breaker is open - Redis connections temporarily disabled',
        connectionStats: stats
      }
    };
  }
  
  try {
    const healthConnection = redisPool.getHealthCheckConnection();
    const start = Date.now();
    
    // Use timeout wrapper for all Redis operations
    await withTimeout(healthConnection.ping(), 10000); // 10 second timeout
    const latency = Date.now() - start;
    
    // Quick info check with timeout
    const [info, memoryInfo] = await Promise.all([
      withTimeout(healthConnection.info('server'), 5000).catch(() => 'timeout'),
      withTimeout(healthConnection.info('memory'), 5000).catch(() => 'timeout')
    ]);
    
    return {
      isHealthy: true,
      details: {
        latency: `${latency}ms`,
        serverInfo: typeof info === 'string' && info !== 'timeout' ? 
          (info.split('\n')[1] || 'Redis server') : 'Redis server (info timeout)',
        memoryUsage: typeof memoryInfo === 'string' && memoryInfo !== 'timeout' ?
          (memoryInfo.match(/used_memory_human:(\S+)/)?.[1] || 'unknown') : 'unknown (timeout)',
        connectionStats: stats
      }
    };
  } catch (error) {
    // Update circuit breaker on health check failure
    redisPool['consecutiveFailures']++;
    
    return {
      isHealthy: false,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionStats: redisPool.getStats()
      }
    };
  }
};

// BullMQ connection factory
export const getBullMQConnection = () => redisPool.getBullMQConnection();

export default redis;