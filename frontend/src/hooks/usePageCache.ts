/**
 * @file usePageCache.ts
 * @description React hook for intelligent page caching functionality.
 * Provides easy-to-use caching interface for React components with automatic
 * cache management, loading states, and optimized data fetching.
 *
 * @author 10x Engineering Team
 * @version 1.0.0 - Smart Navigation Caching Implementation
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PageType,
  getCachedData,
  invalidateCache,
  pageCache,
  setCachedData,
} from "../utils/pageCache";

export interface CacheStatus {
  isFromCache: boolean;
  isFresh: boolean;
  lastUpdated: Date | null;
  expiresAt: Date | null;
  hitCount: number;
}

export interface UseCacheOptions<T> {
  /**
   * Function to fetch fresh data when cache miss occurs
   */
  fetcher: () => Promise<T>;

  /**
   * Page type for cache configuration
   */
  pageType: PageType;

  /**
   * Company ID for cache scoping
   */
  companyId: string;

  /**
   * Optional filters that affect the cached data
   */
  filters?: Record<string, unknown>;

  /**
   * Whether to fetch data immediately on mount
   * @default true
   */
  enabled?: boolean;

  /**
   * Custom cache expiry time in minutes (overrides default for pageType)
   */
  cacheTime?: number;

  /**
   * Whether to return stale data while fetching fresh data in background
   * @default false
   */
  staleWhileRevalidate?: boolean;

  /**
   * Request timeout in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Callback when data is loaded (either from cache or fresh fetch)
   */
  onDataLoaded?: (data: T, isFromCache: boolean) => void;

  /**
   * Callback when fetch fails
   */
  onError?: (error: Error) => void;
}

export interface UseCacheResult<T> {
  /**
   * The cached or fetched data
   */
  data: T | null;

  /**
   * Whether data is currently being fetched
   */
  loading: boolean;

  /**
   * Whether data is being refreshed (has data but fetching new)
   */
  refreshing: boolean;

  /**
   * Error from last fetch attempt
   */
  error: Error | null;

  /**
   * Information about cache status
   */
  cacheStatus: CacheStatus;

  /**
   * Function to manually trigger a refresh (bypasses cache)
   */
  refresh: () => Promise<void>;

  /**
   * Function to invalidate cache for this data
   */
  invalidate: () => void;

  /**
   * Function to manually set data in cache
   */
  setData: (data: T) => void;
}

/**
 * Main cache hook for React components
 */
export function usePageCache<T>(
  options: UseCacheOptions<T>
): UseCacheResult<T> {
  const {
    pageType,
    companyId,
    filters,
    enabled = true,
    staleWhileRevalidate = false,
  } = options;

  // State management
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>({
    isFromCache: false,
    isFresh: false,
    lastUpdated: null,
    expiresAt: null,
    hitCount: 0,
  });

  // Track if component is mounted to prevent state updates after unmount
  const mountedRef = useRef(true);
  const lastFetchRef = useRef<Promise<T> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      // Abort any ongoing fetch operations
      if (abortControllerRef.current) {
        console.log("[usePageCache] Component unmounting, aborting fetch");
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * Updates cache status information
   */
  const updateCacheStatus = useCallback(
    (isFromCache: boolean, cacheEntry?: CacheEntry) => {
      if (!mountedRef.current) return;

      const status: CacheStatus = {
        isFromCache,
        isFresh: !isFromCache,
        lastUpdated: cacheEntry ? new Date(cacheEntry.timestamp) : new Date(),
        expiresAt: cacheEntry ? new Date(cacheEntry.expiresAt) : null,
        hitCount: cacheEntry?.metadata?.hits || 0,
      };

      setCacheStatus(status);
    },
    []
  );

  /**
   * Fetches fresh data and updates cache
   */
  const fetchFreshData = useCallback(
    async (isRefresh = false): Promise<T> => {
      try {
        console.log(
          `[usePageCache] Fetching ${isRefresh ? "refresh" : "fresh"} data for ${pageType}:${companyId}`
        );

        // Create abort controller for this fetch
        abortControllerRef.current = new AbortController();

        // Check if component is still mounted before fetching
        if (!mountedRef.current) {
          throw new Error("Component unmounted before fetch");
        }

        const fetchPromise = optionsRef.current.fetcher();
        lastFetchRef.current = fetchPromise;

        // Add timeout handling
        const timeout = optionsRef.current.timeout || 30000; // Default 30 seconds
        let result: T;

        if (timeout > 0) {
          // Race between fetch and timeout
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(
              () => reject(new Error(`Request timed out after ${timeout}ms`)),
              timeout
            );
          });

          result = await Promise.race([fetchPromise, timeoutPromise]);
        } else {
          result = await fetchPromise;
        }

        // Always update cache even if component unmounted - this helps future mounts
        setCachedData(pageType, companyId, result, filters);
        console.log(
          `[usePageCache] Data cached for future use: ${pageType}:${companyId}`
        );

        // Update state only if still mounted
        if (mountedRef.current) {
          setData(result);
          setError(null);
          updateCacheStatus(false);

          // Call onDataLoaded callback
          optionsRef.current.onDataLoaded?.(result, false);

          console.log(
            `[usePageCache] Fresh data loaded and state updated for ${pageType}:${companyId}`
          );
        } else {
          console.log(
            `[usePageCache] Component unmounted, data cached but state not updated for ${pageType}:${companyId}`
          );
        }

        return result;
      } catch (err: unknown) {
        const errorObj = err as Error;
        // Handle abort/unmount errors gracefully (don't treat as real errors)
        const isUnmountCancellation =
          errorObj.name === "AbortError" ||
          errorObj.message === "Component unmounted before fetch" ||
          errorObj.message ===
            "Component unmounted during response processing" ||
          (typeof errorObj.message === "string" &&
            errorObj.message.toLowerCase().includes("component unmounted"));
        if (isUnmountCancellation) {
          console.log(
            `[usePageCache] Fetch cancelled for ${pageType}:${companyId}:`,
            errorObj.message
          );
          throw err; // Re-throw to prevent state updates
        }

        const error = err instanceof Error ? err : new Error("Fetch failed");
        console.error(
          `[usePageCache] Fetch failed for ${pageType}:${companyId}:`,
          error
        );

        // Enhanced error context
        const enhancedError = new Error(error.message);
        enhancedError.name = error.name;
        enhancedError.stack = error.stack;

        // Add context to error
        (
          enhancedError as Error & { context: Record<string, unknown> }
        ).context = {
          pageType,
          companyId,
          filters,
          isRefresh,
          timestamp: new Date().toISOString(),
        };

        // Update error state only if still mounted
        if (mountedRef.current) {
          setError(enhancedError);
          optionsRef.current.onError?.(enhancedError);
        }

        throw enhancedError;
      }
    },
    [pageType, companyId, filters, updateCacheStatus]
  );

  /**
   * Tries to load data from cache first, then fetches if needed
   */
  const loadData = useCallback(
    async (forceRefresh = false) => {
      console.log(`[usePageCache] loadData called:`, {
        pageType,
        companyId,
        enabled,
        forceRefresh,
        currentLoading: loading,
        isMounted: mountedRef.current,
      });

      // Early return if disabled or no company
      if (!enabled || !companyId) {
        console.log(
          `[usePageCache] Early return: enabled=${enabled}, companyId="${companyId}"`
        );
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
          // Clear data if no company selected
          if (!companyId && data !== null) {
            setData(null);
          }
        }
        return;
      }

      // Don't proceed if component is unmounted
      if (!mountedRef.current) {
        console.log(`[usePageCache] Component unmounted, skipping loadData`);
        return;
      }

      try {
        // Try cache first unless force refresh
        if (!forceRefresh) {
          const cachedData = getCachedData<T>(pageType, companyId, filters);
          if (cachedData !== null) {
            console.log(
              `[usePageCache] Cache HIT for ${pageType}:${companyId}, setting data and clearing loading`
            );

            if (mountedRef.current) {
              setData(cachedData);
              setError(null);
              setLoading(false);
              setRefreshing(false);
              updateCacheStatus(true);

              // Call onDataLoaded callback
              options.onDataLoaded?.(cachedData, true);
            }

            // If stale-while-revalidate, fetch fresh data in background
            if (staleWhileRevalidate && mountedRef.current) {
              console.log(
                `[usePageCache] Background refresh for ${pageType}:${companyId}`
              );
              fetchFreshData(true).catch((err) => {
                console.warn(
                  `[usePageCache] Background refresh failed for ${pageType}:${companyId}:`,
                  err
                );
              });
            }

            return;
          }
        }

        console.log(
          `[usePageCache] Cache MISS for ${pageType}:${companyId}, fetching fresh data`
        );

        // Only proceed with fetch if component is still mounted
        if (!mountedRef.current) {
          console.log(
            `[usePageCache] Component unmounted during cache check, aborting fetch`
          );
          return;
        }

        // Set appropriate loading state
        if (forceRefresh && data !== null) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        // Fetch fresh data
        await fetchFreshData(forceRefresh);
      } catch (err: unknown) {
        const errorObj = err as Error;
        // Don't log abort/unmount errors as failures
        const isUnmountCancellationLoad =
          errorObj.name === "AbortError" ||
          errorObj.message === "Component unmounted before fetch" ||
          errorObj.message ===
            "Component unmounted during response processing" ||
          (typeof errorObj.message === "string" &&
            errorObj.message.toLowerCase().includes("component unmounted"));
        if (isUnmountCancellationLoad) {
          console.log(
            `[usePageCache] Load cancelled for ${pageType}:${companyId}:`,
            errorObj.message
          );
        } else {
          console.error(
            `[usePageCache] Load failed for ${pageType}:${companyId}:`,
            err
          );
        }
        // Error is already handled in fetchFreshData
      } finally {
        if (mountedRef.current) {
          console.log(
            `[usePageCache] Setting loading states to false for ${pageType}:${companyId}`
          );
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      enabled,
      companyId,
      pageType,
      filters,
      staleWhileRevalidate,
      fetchFreshData,
      updateCacheStatus,
      data,
      loading,
      options,
    ]
  );

  /**
   * Manual refresh function
   */
  const refresh = useCallback(async (): Promise<void> => {
    await loadData(true);
  }, [loadData]);

  /**
   * Invalidate cache for this data
   */
  const invalidate = useCallback(() => {
    invalidateCache(pageType, companyId);
    console.log(
      `[usePageCache] Invalidated cache for ${pageType}:${companyId}`
    );
  }, [pageType, companyId]);

  /**
   * Manually set data in cache
   */
  const setDataAndCache = useCallback(
    (newData: T) => {
      // Always update the cache regardless of mount status for consistency
      setCachedData(pageType, companyId, newData, filters);

      // Update component state only if still mounted
      if (mountedRef.current) {
        setData(newData);
        setError(null);
        updateCacheStatus(false);
      }
    },
    [pageType, companyId, filters, updateCacheStatus]
  );

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    loading,
    refreshing,
    error,
    cacheStatus,
    refresh,
    invalidate,
    setData: setDataAndCache,
  };
}

/**
 * Hook for cache-aware data mutations that automatically invalidate related caches
 */
export function useCacheMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: Error, variables: TVariables) => void;
    invalidatePatterns?: Array<{
      pageType: PageType;
      companyId?: string;
    }>;
  }
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (variables: TVariables): Promise<TData> => {
      setLoading(true);
      setError(null);

      try {
        const result = await mutationFn(variables);

        // Invalidate specified cache patterns
        options?.invalidatePatterns?.forEach(({ pageType, companyId }) => {
          invalidateCache(pageType, companyId);
        });

        options?.onSuccess?.(result, variables);
        return result;
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error("Mutation failed");
        setError(error);
        options?.onError?.(error, variables);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [mutationFn, options]
  );

  return {
    mutate,
    loading,
    error,
  };
}

/**
 * Hook for prefetching data to warm the cache
 */
export function useCachePrefetch() {
  const prefetch = useCallback(
    <T>(
      pageType: PageType,
      companyId: string,
      fetcher: () => Promise<T>,
      filters?: Record<string, unknown>
    ): Promise<void> => {
      // Only prefetch if not already cached
      const cached = getCachedData<T>(pageType, companyId, filters);
      if (cached !== null) {
        return Promise.resolve();
      }

      console.log(
        `[usePageCache] Prefetching data for ${pageType}:${companyId}`
      );

      return fetcher()
        .then((data) => {
          setCachedData(pageType, companyId, data, filters);
          console.log(
            `[usePageCache] Prefetch complete for ${pageType}:${companyId}`
          );
        })
        .catch((err) => {
          console.warn(
            `[usePageCache] Prefetch failed for ${pageType}:${companyId}:`,
            err
          );
        });
    },
    []
  );

  return { prefetch };
}

/**
 * Hook for accessing cache statistics and management
 */
export function useCacheManagement() {
  const [stats, setStats] = useState(pageCache.getStats());

  const updateStats = useCallback(() => {
    setStats(pageCache.getStats());
  }, []);

  const clearCache = useCallback(() => {
    pageCache.clear();
    updateStats();
  }, [updateStats]);

  const clearCompanyCache = useCallback(
    (companyId: string) => {
      pageCache.clearCompany(companyId);
      updateStats();
    },
    [updateStats]
  );

  return {
    stats,
    updateStats,
    clearCache,
    clearCompanyCache,
  };
}
