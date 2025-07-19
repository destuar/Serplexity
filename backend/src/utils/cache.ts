/**
 * @file cache.ts
 * @description This file defines the `CacheService`, which provides a simple interface for interacting with Redis as a caching layer.
 * It includes methods for getting, setting, and deleting cached data, as well as invalidating cache entries by pattern.
 * It also defines common cache keys for various application data. This service is crucial for improving application performance
 * by reducing database load and speeding up data retrieval.
 *
 * @dependencies
 * - ../config/redis: The Redis client for caching operations.
 * - ./logger: Logger for application-level logging.
 *
 * @exports
 * - CacheService: The class providing caching functionalities.
 * - default: A singleton instance of the CacheService.
 */
import { redis } from "../config/redis";
import logger from "./logger";

export class CacheService {
  private defaultTTL = 3600; // 1 hour default TTL

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
      return null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const ttl = ttlSeconds || this.defaultTTL;
      await redis.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        return await redis.del(...keys);
      }
      return 0;
    } catch (error) {
      logger.error(`Cache pattern invalidation error for ${pattern}:`, error);
      return 0;
    }
  }

  // Cache keys for common operations
  static keys = {
    // Dashboard data cache
    dashboardData: (companyId: string, timeRange: string) =>
      `dashboard:${companyId}:${timeRange}`,

    // Report metrics cache
    reportMetrics: (reportId: string) => `metrics:report:${reportId}`,

    // Company competitors cache
    competitors: (companyId: string) => `competitors:${companyId}`,

    // LLM response cache (for repeated queries)
    llmResponse: (prompt: string, model: string) =>
      `llm:${model}:${Buffer.from(prompt).toString("base64").slice(0, 50)}`,
  };
}

export default new CacheService();
