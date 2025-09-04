/**
 * @file distributedLockService.ts
 * @description Distributed locking service using Redis to prevent race conditions
 * between multiple schedulers and workers. Implements a robust locking mechanism
 * with automatic expiration and deadlock prevention.
 *
 * @dependencies
 * - ioredis: Redis client for atomic operations
 * - ../config/redis: Redis connection manager
 * - ../utils/logger: Application logging
 *
 * @exports
 * - DistributedLockService: Main service class with locking operations
 * - distributedLockService: Singleton instance
 */

import { Redis } from "ioredis";
import { redisManager } from "../config/redis";
import logger from "../utils/logger";

export interface LockOptions {
  ttl?: number; // Lock time-to-live in milliseconds
  retryDelay?: number; // Delay between retry attempts in milliseconds
  maxRetries?: number; // Maximum number of retry attempts
}

export interface LockResult {
  acquired: boolean;
  lockId?: string;
  remainingTtl?: number;
}

export class DistributedLockService {
  private redis: Redis;

  // Default configuration
  private static readonly DEFAULT_TTL = 300000; // 5 minutes
  private static readonly DEFAULT_RETRY_DELAY = 1000; // 1 second
  private static readonly DEFAULT_MAX_RETRIES = 5;
  private static readonly LOCK_PREFIX = "serplexity:lock:";
  private static readonly HEARTBEAT_INTERVAL = 60000; // 1 minute

  private activeLocks = new Map<string, NodeJS.Timeout>();
  private isShuttingDown = false;

  constructor() {
    this.redis = redisManager.getConnection();
    this.setupGracefulShutdown();
  }

  /**
   * Acquires a distributed lock with the given key
   * @param key - Unique identifier for the lock
   * @param options - Lock configuration options
   * @returns Promise<LockResult> - Result of the lock acquisition attempt
   */
  public async acquireLock(
    key: string,
    options: LockOptions = {}
  ): Promise<LockResult> {
    const {
      ttl = DistributedLockService.DEFAULT_TTL,
      retryDelay = DistributedLockService.DEFAULT_RETRY_DELAY,
      maxRetries = DistributedLockService.DEFAULT_MAX_RETRIES,
    } = options;

    const lockKey = this.getLockKey(key);
    const lockId = this.generateLockId();
    
    logger.debug(`[DistributedLock] Attempting to acquire lock: ${lockKey}`);

    let attempts = 0;
    while (attempts <= maxRetries && !this.isShuttingDown) {
      try {
        // Use SET with NX (only if not exists) and PX (expiration in milliseconds)
        const result = await this.redis.set(
          lockKey,
          lockId,
          "PX",
          ttl,
          "NX"
        );

        if (result === "OK") {
          logger.info(`[DistributedLock] Lock acquired: ${lockKey} (${lockId})`);
          
          // Start heartbeat to extend lock if needed
          this.startHeartbeat(lockKey, lockId, ttl);
          
          return {
            acquired: true,
            lockId,
            remainingTtl: ttl,
          };
        }

        // Lock is already held, check remaining TTL
        const remainingTtl = await this.redis.pttl(lockKey);
        logger.debug(
          `[DistributedLock] Lock already held: ${lockKey}, remaining TTL: ${remainingTtl}ms`
        );

        if (attempts < maxRetries) {
          logger.debug(
            `[DistributedLock] Retrying in ${retryDelay}ms (attempt ${attempts + 1}/${maxRetries})`
          );
          await this.sleep(retryDelay);
        }

        attempts++;
      } catch (error) {
        logger.error(`[DistributedLock] Error acquiring lock ${lockKey}:`, {
          error: error instanceof Error ? error.message : error,
          attempt: attempts + 1,
        });
        
        if (attempts < maxRetries) {
          await this.sleep(retryDelay);
        }
        attempts++;
      }
    }

    logger.warn(`[DistributedLock] Failed to acquire lock after ${maxRetries} attempts: ${lockKey}`);
    return { acquired: false };
  }

  /**
   * Releases a distributed lock
   * @param key - Lock key to release
   * @param lockId - Lock ID for verification (prevents releasing someone else's lock)
   * @returns Promise<boolean> - Whether the lock was successfully released
   */
  public async releaseLock(key: string, lockId: string): Promise<boolean> {
    const lockKey = this.getLockKey(key);
    
    logger.debug(`[DistributedLock] Attempting to release lock: ${lockKey} (${lockId})`);

    try {
      // Lua script to atomically check lock ownership and release
      const script = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(script, 1, lockKey, lockId) as number;
      
      if (result === 1) {
        logger.info(`[DistributedLock] Lock released: ${lockKey} (${lockId})`);
        this.stopHeartbeat(lockKey);
        return true;
      } else {
        logger.warn(`[DistributedLock] Failed to release lock - not owner: ${lockKey} (${lockId})`);
        return false;
      }
    } catch (error) {
      logger.error(`[DistributedLock] Error releasing lock ${lockKey}:`, {
        error: error instanceof Error ? error.message : error,
        lockId,
      });
      return false;
    }
  }

  /**
   * Extends the TTL of an existing lock
   * @param key - Lock key to extend
   * @param lockId - Lock ID for verification
   * @param additionalTtl - Additional time in milliseconds
   * @returns Promise<boolean> - Whether the lock was successfully extended
   */
  public async extendLock(
    key: string,
    lockId: string,
    additionalTtl: number = DistributedLockService.DEFAULT_TTL
  ): Promise<boolean> {
    const lockKey = this.getLockKey(key);
    
    try {
      // Lua script to atomically check ownership and extend TTL
      const script = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("PEXPIRE", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(
        script,
        1,
        lockKey,
        lockId,
        additionalTtl.toString()
      ) as number;

      if (result === 1) {
        logger.debug(`[DistributedLock] Lock extended: ${lockKey} (${lockId}) +${additionalTtl}ms`);
        return true;
      } else {
        logger.warn(`[DistributedLock] Failed to extend lock - not owner: ${lockKey} (${lockId})`);
        return false;
      }
    } catch (error) {
      logger.error(`[DistributedLock] Error extending lock ${lockKey}:`, {
        error: error instanceof Error ? error.message : error,
        lockId,
      });
      return false;
    }
  }

  /**
   * Checks if a lock is currently held
   * @param key - Lock key to check
   * @returns Promise<{held: boolean, remainingTtl?: number}> - Lock status
   */
  public async isLockHeld(key: string): Promise<{ held: boolean; remainingTtl?: number }> {
    const lockKey = this.getLockKey(key);
    
    try {
      const remainingTtl = await this.redis.pttl(lockKey);
      
      if (remainingTtl === -2) {
        // Key does not exist
        return { held: false };
      } else if (remainingTtl === -1) {
        // Key exists but has no expiration
        return { held: true };
      } else {
        // Key exists with TTL
        return { held: true, remainingTtl };
      }
    } catch (error) {
      logger.error(`[DistributedLock] Error checking lock status ${lockKey}:`, {
        error: error instanceof Error ? error.message : error,
      });
      return { held: false };
    }
  }

  /**
   * Force releases any lock with the given key (admin operation)
   * @param key - Lock key to force release
   * @returns Promise<boolean> - Whether the operation succeeded
   */
  public async forceReleaseLock(key: string): Promise<boolean> {
    const lockKey = this.getLockKey(key);
    
    logger.warn(`[DistributedLock] Force releasing lock: ${lockKey}`);
    
    try {
      const result = await this.redis.del(lockKey);
      this.stopHeartbeat(lockKey);
      
      if (result === 1) {
        logger.info(`[DistributedLock] Lock force released: ${lockKey}`);
        return true;
      } else {
        logger.info(`[DistributedLock] Lock was not held: ${lockKey}`);
        return false;
      }
    } catch (error) {
      logger.error(`[DistributedLock] Error force releasing lock ${lockKey}:`, {
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }

  /**
   * Lists all active locks (for monitoring/debugging)
   * @returns Promise<Array<{key: string, ttl: number}>> - List of active locks
   */
  public async listActiveLocks(): Promise<Array<{ key: string; ttl: number }>> {
    try {
      const pattern = `${DistributedLockService.LOCK_PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      
      const locks = await Promise.all(
        keys.map(async (key) => {
          const ttl = await this.redis.pttl(key);
          return {
            key: key.replace(DistributedLockService.LOCK_PREFIX, ""),
            ttl,
          };
        })
      );
      
      return locks.filter(lock => lock.ttl > 0);
    } catch (error) {
      logger.error("[DistributedLock] Error listing active locks:", {
        error: error instanceof Error ? error.message : error,
      });
      return [];
    }
  }

  private getLockKey(key: string): string {
    return `${DistributedLockService.LOCK_PREFIX}${key}`;
  }

  private generateLockId(): string {
    return `${process.pid}-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private startHeartbeat(lockKey: string, lockId: string, ttl: number): void {
    // Stop any existing heartbeat for this lock
    this.stopHeartbeat(lockKey);
    
    const heartbeatInterval = setInterval(async () => {
      if (this.isShuttingDown) {
        this.stopHeartbeat(lockKey);
        return;
      }
      
      try {
        const extended = await this.extendLock(lockKey.replace(DistributedLockService.LOCK_PREFIX, ""), lockId, ttl);
        if (!extended) {
          logger.warn(`[DistributedLock] Heartbeat failed for lock: ${lockKey} (${lockId})`);
          this.stopHeartbeat(lockKey);
        }
      } catch (error) {
        logger.error(`[DistributedLock] Heartbeat error for lock ${lockKey}:`, {
          error: error instanceof Error ? error.message : error,
          lockId,
        });
      }
    }, DistributedLockService.HEARTBEAT_INTERVAL);
    
    this.activeLocks.set(lockKey, heartbeatInterval);
  }

  private stopHeartbeat(lockKey: string): void {
    const heartbeat = this.activeLocks.get(lockKey);
    if (heartbeat) {
      clearInterval(heartbeat);
      this.activeLocks.delete(lockKey);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      logger.info("[DistributedLock] Starting graceful shutdown");
      this.isShuttingDown = true;
      
      // Stop all heartbeats
      for (const [lockKey, heartbeat] of this.activeLocks) {
        clearInterval(heartbeat);
        logger.debug(`[DistributedLock] Stopped heartbeat for: ${lockKey}`);
      }
      
      this.activeLocks.clear();
      logger.info("[DistributedLock] Shutdown complete");
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  }
}

// Export singleton instance
export const distributedLockService = new DistributedLockService();