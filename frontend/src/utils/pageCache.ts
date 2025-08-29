/**
 * @file pageCache.ts
 * @description Universal page caching system for Serplexity dashboard.
 * Provides intelligent caching with time-based expiration, compression, and storage management.
 * Designed to eliminate unnecessary API calls when switching between tabs.
 *
 * @author 10x Engineering Team
 * @version 1.0.0 - Smart Navigation Caching Implementation
 */

// Cache configuration constants
export const CACHE_CONFIG = {
  // Storage keys
  STORAGE_KEY: "serplexity_page_cache",
  VERSION_KEY: "serplexity_cache_version",

  // Cache expiration times (in minutes)
  EXPIRY: {
    DASHBOARD: 10, // Dashboard analytics data
    COMPETITORS: 15, // Competitor lists and data
    WEB_AUDIT: 30, // Audit results (expensive to regenerate)
    WEB_ANALYTICS: 10, // Analytics data
    VISIBILITY_TASKS: 5, // Task lists (need to be fresh)
    SEO_ANALYTICS: 10, // SEO data
    PROMPTS: 60, // Relatively static content
    ACCEPTED_COMPETITORS: 30, // Shared competitor data (longer cache)
    DEFAULT: 15,
  },

  // Storage limits
  MAX_CACHE_SIZE: 50 * 1024 * 1024, // 50MB max cache size
  MAX_ENTRIES: 1000, // Maximum number of cache entries
  CLEANUP_THRESHOLD: 0.8, // Cleanup when 80% full

  // Performance settings
  BATCH_SAVE_DELAY: 100, // Delay for batched saves (ms)
  MAX_SAVE_FREQUENCY: 500, // Maximum save frequency (ms)
  COMPRESSION_MIN_SIZE: 1024, // Minimum size for compression (bytes)

  // Current cache version (increment to invalidate all caches)
  VERSION: "1.0.0",
} as const;

export type PageType =
  | "dashboard"
  | "competitors"
  | "web-audit"
  | "web-analytics"
  | "visibility-tasks"
  | "seo-analytics"
  | "prompts"
  | "accepted-competitors" // For reusable competitor data
  | "other";

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  expiresAt: number;
  version: string;
  metadata: {
    companyId: string;
    pageType: PageType;
    filters?: Record<string, unknown>;
    dataSize: number;
    hits: number;
  };
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  oldestEntry: number;
  newestEntry: number;
  performance?: {
    totalRequests: number;
    totalHits: number;
    averageEntrySize: number;
    pendingOperations: number;
    lastSaveTime: number;
  };
}

/**
 * Generates a consistent cache key based on page type, company, and filters
 */
export function generateCacheKey(
  pageType: PageType,
  companyId: string,
  filters?: Record<string, unknown>
): string {
  const baseKey = `${pageType}:${companyId}`;

  if (!filters || Object.keys(filters).length === 0) {
    return baseKey;
  }

  // Create consistent hash of filters
  const sortedFilters = Object.keys(filters)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = filters[key];
        return acc;
      },
      {} as Record<string, unknown>
    );

  const filterHash = btoa(JSON.stringify(sortedFilters))
    .replace(/[/+=]/g, "")
    .substring(0, 16);

  return `${baseKey}:${filterHash}`;
}

/**
 * Converts string to base64 with proper UTF-8 encoding
 */
function stringToBase64(str: string): string {
  try {
    // Use TextEncoder for proper UTF-8 encoding
    const encoder = new TextEncoder();
    const data = encoder.encode(str);

    // Convert Uint8Array to base64
    let binary = "";
    const bytes = new Uint8Array(data);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
  } catch (error) {
    console.error("[PageCache] Failed to encode to base64:", error);
    // Fallback: try direct btoa for Latin1-only strings
    try {
      return btoa(str);
    } catch (fallbackError) {
      console.error(
        "[PageCache] Fallback encoding also failed:",
        fallbackError
      );
      throw new Error("Failed to encode data to base64");
    }
  }
}

/**
 * Converts base64 back to string with proper UTF-8 decoding
 */
function base64ToString(base64: string): string {
  try {
    const binary = atob(base64);

    // Convert binary string back to Uint8Array
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Use TextDecoder for proper UTF-8 decoding
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  } catch (error) {
    console.error("[PageCache] Failed to decode from base64:", error);
    // Fallback: try direct atob for simple cases
    try {
      return atob(base64);
    } catch (fallbackError) {
      console.error(
        "[PageCache] Fallback decoding also failed:",
        fallbackError
      );
      throw new Error("Failed to decode data from base64");
    }
  }
}

/**
 * Compresses data using JSON stringification and UTF-8 safe base64 encoding
 * Only compresses data larger than the minimum threshold for performance
 */
function compressData<T>(data: T): string {
  try {
    const jsonString = JSON.stringify(data);

    // Only compress if data is above threshold
    if (jsonString.length < CACHE_CONFIG.COMPRESSION_MIN_SIZE) {
      return `raw:${jsonString}`;
    }

    return `b64:${stringToBase64(jsonString)}`;
  } catch (error) {
    console.error("[PageCache] Failed to compress data:", error);
    // Try without compression as fallback
    try {
      const jsonString = JSON.stringify(data);
      console.warn("[PageCache] Using uncompressed fallback for data storage");
      return `raw:${jsonString}`;
    } catch (fallbackError) {
      console.error(
        "[PageCache] Even uncompressed fallback failed:",
        fallbackError
      );
      throw new Error("Failed to compress cache data");
    }
  }
}

/**
 * Decompresses data from storage with fallback support
 */
function decompressData<T>(compressedData: string): T {
  try {
    // Check compression format
    if (compressedData.startsWith("raw:")) {
      // Uncompressed data
      const jsonString = compressedData.substring(4);
      return JSON.parse(jsonString) as T;
    } else if (compressedData.startsWith("b64:")) {
      // Base64 compressed data
      const base64Data = compressedData.substring(4);
      const jsonString = base64ToString(base64Data);
      return JSON.parse(jsonString) as T;
    } else {
      // Legacy format - try base64 decoding first
      const jsonString = base64ToString(compressedData);
      return JSON.parse(jsonString) as T;
    }
  } catch (error) {
    console.warn(
      "[PageCache] Primary decompression failed, trying fallback:",
      error
    );
    // Fallback: try parsing directly as JSON (for legacy uncompressed data)
    try {
      return JSON.parse(compressedData) as T;
    } catch (fallbackError) {
      console.error("[PageCache] Failed to decompress data:", fallbackError);
      throw new Error("Failed to decompress cache data");
    }
  }
}

/**
 * Gets the appropriate storage mechanism (sessionStorage preferred, memory fallback)
 */
function getStorage(): Storage | Map<string, string> {
  try {
    // Test if sessionStorage is available and working
    const testKey = "__cache_test__";
    sessionStorage.setItem(testKey, "test");
    sessionStorage.removeItem(testKey);
    return sessionStorage;
  } catch {
    // Fallback to in-memory storage for incognito mode or disabled storage
    console.warn(
      "[PageCache] SessionStorage unavailable, using memory storage"
    );
    return new Map<string, string>();
  }
}

// Initialize storage
const storage = getStorage();
const isMemoryStorage = storage instanceof Map;

/**
 * Storage helpers that work with both sessionStorage and Map
 */
const storageHelpers = {
  getItem(key: string): string | null {
    if (isMemoryStorage) {
      return (storage as Map<string, string>).get(key) || null;
    }
    return (storage as Storage).getItem(key);
  },

  setItem(key: string, value: string): void {
    if (isMemoryStorage) {
      (storage as Map<string, string>).set(key, value);
    } else {
      try {
        (storage as Storage).setItem(key, value);
      } catch (error) {
        console.warn(
          "[PageCache] Failed to write to storage, cache disabled:",
          error
        );
      }
    }
  },

  removeItem(key: string): void {
    if (isMemoryStorage) {
      (storage as Map<string, string>).delete(key);
    } else {
      (storage as Storage).removeItem(key);
    }
  },

  clear(): void {
    if (isMemoryStorage) {
      (storage as Map<string, string>).clear();
    } else {
      (storage as Storage).clear();
    }
  },
};

/**
 * Loads the entire cache from storage
 */
function loadCache(): Record<string, CacheEntry> {
  try {
    const cacheData = storageHelpers.getItem(CACHE_CONFIG.STORAGE_KEY);
    if (!cacheData) {
      return {};
    }

    const cache = decompressData<Record<string, CacheEntry>>(cacheData);

    // Verify cache version
    const storedVersion = storageHelpers.getItem(CACHE_CONFIG.VERSION_KEY);
    if (storedVersion !== CACHE_CONFIG.VERSION) {
      console.log("[PageCache] Cache version mismatch, clearing cache");
      storageHelpers.clear();
      return {};
    }

    return cache;
  } catch (error) {
    console.error("[PageCache] Failed to load cache:", error);
    return {};
  }
}

/**
 * Saves the entire cache to storage
 */
function saveCache(cache: Record<string, CacheEntry>): void {
  try {
    const compressedCache = compressData(cache);
    storageHelpers.setItem(CACHE_CONFIG.STORAGE_KEY, compressedCache);
    storageHelpers.setItem(CACHE_CONFIG.VERSION_KEY, CACHE_CONFIG.VERSION);
  } catch (error) {
    console.error("[PageCache] Failed to save cache:", error);
    // Don't throw - gracefully degrade to no caching
  }
}

/**
 * Calculates the size of cache data in bytes
 */
function calculateDataSize(data: unknown): number {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    // Fallback size estimation
    return JSON.stringify(data).length * 2; // Rough UTF-16 estimation
  }
}

/**
 * Main cache class implementing the caching logic
 */
class PageCacheManager {
  private cache: Record<string, CacheEntry> = {};
  private hitCounts: Record<string, number> = {};
  private totalRequests = 0;
  private saveTimer: NodeJS.Timeout | null = null;
  private lastSaveTime = 0;
  private pendingOperations = new Set<string>();

  constructor() {
    this.cache = loadCache();
    this.cleanupExpiredEntries();

    // Cleanup on page unload
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        this.cleanup();
      });
    }
  }

  /**
   * Cleanup method to flush pending operations
   */
  private cleanup(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      // Force save on cleanup
      saveCache(this.cache);
    }
  }

  /**
   * Gets data from cache if valid, null if expired or not found
   */
  get<T>(key: string): T | null {
    this.totalRequests++;

    const entry = this.cache[key];
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      console.log(`[PageCache] Entry expired: ${key}`);
      delete this.cache[key];
      this.saveCache();
      return null;
    }

    // Update hit counter
    entry.metadata.hits++;
    this.hitCounts[key] = (this.hitCounts[key] || 0) + 1;

    console.log(`[PageCache] Cache HIT: ${key} (${entry.metadata.hits} hits)`);

    try {
      return entry.data as T;
    } catch (error) {
      console.error(
        `[PageCache] Failed to parse cached data for ${key}:`,
        error
      );
      delete this.cache[key];
      this.saveCache();
      return null;
    }
  }

  /**
   * Stores data in cache with appropriate expiration
   */
  set<T>(
    key: string,
    data: T,
    pageType: PageType,
    companyId: string,
    filters?: Record<string, unknown>
  ): void {
    const now = Date.now();
    const expiryKey = pageType
      .replace(/-/g, "_")
      .toUpperCase() as keyof typeof CACHE_CONFIG.EXPIRY;
    const expiryMinutes =
      CACHE_CONFIG.EXPIRY[expiryKey] || CACHE_CONFIG.EXPIRY.DEFAULT;

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + expiryMinutes * 60 * 1000,
      version: CACHE_CONFIG.VERSION,
      metadata: {
        companyId,
        pageType,
        filters,
        dataSize: calculateDataSize(data),
        hits: 0,
      },
    };

    // Check if we need to cleanup before adding
    this.checkAndCleanup();

    this.cache[key] = entry;
    this.saveCache();

    console.log(
      `[PageCache] Stored: ${key} (expires in ${expiryMinutes}m, size: ${entry.metadata.dataSize} bytes)`
    );
  }

  /**
   * Removes a specific cache entry
   */
  remove(key: string): void {
    delete this.cache[key];
    delete this.hitCounts[key];
    this.saveCache();
    console.log(`[PageCache] Removed: ${key}`);
  }

  /**
   * Clears all cache entries
   */
  clear(): void {
    this.cache = {};
    this.hitCounts = {};
    storageHelpers.clear();
    console.log("[PageCache] Cache cleared");
  }

  /**
   * Clears cache entries for a specific company
   */
  clearCompany(companyId: string): void {
    const keysToDelete = Object.keys(this.cache).filter(
      (key) => this.cache[key]?.metadata.companyId === companyId
    );

    keysToDelete.forEach((key) => {
      delete this.cache[key];
      delete this.hitCounts[key];
    });

    this.saveCache();
    console.log(
      `[PageCache] Cleared ${keysToDelete.length} entries for company ${companyId}`
    );
  }

  /**
   * Clears cache entries for a specific page type
   */
  clearPageType(pageType: PageType): void {
    const keysToDelete = Object.keys(this.cache).filter(
      (key) => this.cache[key]?.metadata.pageType === pageType
    );

    keysToDelete.forEach((key) => {
      delete this.cache[key];
      delete this.hitCounts[key];
    });

    this.saveCache();
    console.log(
      `[PageCache] Cleared ${keysToDelete.length} entries for page type ${pageType}`
    );
  }

  /**
   * Forces refresh of cache entries (removes them so they'll be refetched)
   */
  invalidateKeys(keys: string[]): void {
    keys.forEach((key) => {
      delete this.cache[key];
      delete this.hitCounts[key];
    });

    this.saveCache();
    console.log(`[PageCache] Invalidated ${keys.length} cache entries`);
  }

  /**
   * Gets cache statistics for monitoring
   */
  getStats(): CacheStats {
    const entries = Object.values(this.cache);
    const totalSize = entries.reduce(
      (sum, entry) => sum + entry.metadata.dataSize,
      0
    );
    const timestamps = entries.map((entry) => entry.timestamp);

    const totalHits = Object.values(this.hitCounts).reduce(
      (sum, hits) => sum + hits,
      0
    );
    const hitRate =
      this.totalRequests > 0 ? (totalHits / this.totalRequests) * 100 : 0;

    return {
      totalEntries: entries.length,
      totalSize,
      hitRate: Math.round(hitRate * 100) / 100,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0,
      performance: {
        totalRequests: this.totalRequests,
        totalHits,
        averageEntrySize:
          entries.length > 0 ? Math.round(totalSize / entries.length) : 0,
        pendingOperations: this.pendingOperations.size,
        lastSaveTime: this.lastSaveTime,
      },
    };
  }

  /**
   * Checks if we need to cleanup and performs cleanup if necessary
   */
  private checkAndCleanup(): void {
    const stats = this.getStats();

    if (
      stats.totalEntries > CACHE_CONFIG.MAX_ENTRIES ||
      stats.totalSize >
        CACHE_CONFIG.MAX_CACHE_SIZE * CACHE_CONFIG.CLEANUP_THRESHOLD
    ) {
      console.log("[PageCache] Cleanup threshold reached, performing cleanup");
      this.performCleanup();
    }
  }

  /**
   * Removes expired entries from cache
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys = Object.keys(this.cache).filter(
      (key) => this.cache[key] && now > this.cache[key].expiresAt
    );

    expiredKeys.forEach((key) => {
      delete this.cache[key];
      delete this.hitCounts[key];
    });

    if (expiredKeys.length > 0) {
      this.saveCache();
      console.log(
        `[PageCache] Cleaned up ${expiredKeys.length} expired entries`
      );
    }
  }

  /**
   * Performs intelligent cleanup of cache entries
   */
  private performCleanup(): void {
    const entries = Object.entries(this.cache);

    // Remove expired entries first
    this.cleanupExpiredEntries();

    // If still over threshold, remove least-recently-used entries
    const stats = this.getStats();
    if (stats.totalEntries > CACHE_CONFIG.MAX_ENTRIES * 0.7) {
      // Sort by hit count (ascending) and timestamp (ascending) for LRU
      entries
        .sort(([keyA, entryA], [keyB, entryB]) => {
          const hitsA = this.hitCounts[keyA] || 0;
          const hitsB = this.hitCounts[keyB] || 0;

          if (hitsA !== hitsB) {
            return hitsA - hitsB; // Fewer hits first
          }

          return entryA.timestamp - entryB.timestamp; // Older first
        })
        .slice(0, Math.floor(stats.totalEntries * 0.3)) // Remove 30%
        .forEach(([key]) => {
          delete this.cache[key];
          delete this.hitCounts[key];
        });

      this.saveCache();
      console.log("[PageCache] Performed LRU cleanup");
    }
  }

  /**
   * Saves cache to storage with batching optimization
   */
  private saveCache(): void {
    const now = Date.now();

    // Rate limiting: don't save too frequently
    if (now - this.lastSaveTime < CACHE_CONFIG.MAX_SAVE_FREQUENCY) {
      this.scheduleBatchedSave();
      return;
    }

    this.lastSaveTime = now;
    this.cancelBatchedSave();
    saveCache(this.cache);
  }

  /**
   * Schedules a batched save operation
   */
  private scheduleBatchedSave(): void {
    if (this.saveTimer) return; // Already scheduled

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.lastSaveTime = Date.now();
      saveCache(this.cache);
    }, CACHE_CONFIG.BATCH_SAVE_DELAY);
  }

  /**
   * Cancels pending batched save
   */
  private cancelBatchedSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }
}

// Export singleton instance
export const pageCache = new PageCacheManager();

// Export convenience functions
export function getCachedData<T>(
  pageType: PageType,
  companyId: string,
  filters?: Record<string, unknown>
): T | null {
  const key = generateCacheKey(pageType, companyId, filters);
  const result = pageCache.get<T>(key);
  // Only log cache misses and hits, not every call
  if (result === null) {
    console.log(`[PageCache] MISS: ${key}`);
  }
  return result;
}

export function setCachedData<T>(
  pageType: PageType,
  companyId: string,
  data: T,
  filters?: Record<string, unknown>
): void {
  const key = generateCacheKey(pageType, companyId, filters);
  pageCache.set(key, data, pageType, companyId, filters);
}

export function invalidateCache(pageType?: PageType, companyId?: string): void {
  if (pageType && companyId) {
    // Invalidate specific page type for company
    const keys = Object.keys(pageCache["cache"]).filter((key) => {
      const entry = pageCache["cache"][key];
      return (
        entry?.metadata.pageType === pageType &&
        entry?.metadata.companyId === companyId
      );
    });
    pageCache.invalidateKeys(keys);
  } else if (companyId) {
    // Invalidate all for company
    pageCache.clearCompany(companyId);
  } else if (pageType) {
    // Invalidate all for page type
    pageCache.clearPageType(pageType);
  } else {
    // Clear everything
    pageCache.clear();
  }
}

// Development helpers
if (process.env.NODE_ENV === "development") {
  // Make cache available on window for debugging
  (window as Record<string, unknown>).__SERPLEXITY_CACHE__ = {
    cache: pageCache,
    stats: () => pageCache.getStats(),
    clear: () => pageCache.clear(),
    inspect: () => console.table(pageCache.getStats()),
  };
}
