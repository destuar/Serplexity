/**
 * @file PageCacheContext.tsx
 * @description Global context for page caching system management.
 * Provides cache coordination, statistics, and management functions across
 * the entire application for optimal navigation performance.
 * 
 * @author 10x Engineering Team
 * @version 1.0.0 - Smart Navigation Caching Implementation
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useCompany } from './CompanyContext';
import { 
  pageCache, 
  invalidateCache, 
  PageType, 
  CACHE_CONFIG,
  CacheStats 
} from '../utils/pageCache';

export interface CacheContextValue {
  /**
   * Current cache statistics
   */
  stats: CacheStats;
  
  /**
   * Whether cache is currently being managed/cleaned
   */
  isManaging: boolean;
  
  /**
   * Refresh cache statistics
   */
  refreshStats: () => void;
  
  /**
   * Clear all cache data
   */
  clearAll: () => void;
  
  /**
   * Clear cache for current company
   */
  clearCompany: () => void;
  
  /**
   * Clear cache for specific page type
   */
  clearPageType: (pageType: PageType) => void;
  
  /**
   * Invalidate cache entries and trigger refresh
   */
  invalidate: (pageType?: PageType, companyId?: string) => void;
  
  /**
   * Preload cache for likely navigation targets
   */
  preloadNavigation: (targetPages: PageType[]) => void;
  
  /**
   * Get cache hit rate percentage
   */
  getCacheHitRate: () => number;
  
  /**
   * Check if cache needs attention (cleanup, too large, etc.)
   */
  getCacheHealth: () => {
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    recommendations: string[];
  };
}

const PageCacheContext = createContext<CacheContextValue | null>(null);

export interface PageCacheProviderProps {
  children: React.ReactNode;
}

export const PageCacheProvider: React.FC<PageCacheProviderProps> = ({ children }) => {
  const { selectedCompany } = useCompany();
  const [stats, setStats] = useState<CacheStats>(pageCache.getStats());
  const [isManaging, setIsManaging] = useState(false);
  const lastCompanyRef = useRef<string | null>(null);
  
  // Refresh stats periodically and on cache changes
  const refreshStats = useCallback(() => {
    setStats(pageCache.getStats());
  }, []);
  
  // Auto-refresh stats every 30 seconds
  useEffect(() => {
    const interval = setInterval(refreshStats, 30000);
    return () => clearInterval(interval);
  }, [refreshStats]);
  
  // Clear cache when company changes (cleanup old company data)
  useEffect(() => {
    const currentCompanyId = selectedCompany?.id || null;
    const lastCompanyId = lastCompanyRef.current;
    
    if (lastCompanyId && lastCompanyId !== currentCompanyId) {
      console.log(`[PageCacheContext] Company changed from ${lastCompanyId} to ${currentCompanyId}, clearing old cache`);
      pageCache.clearCompany(lastCompanyId);
      refreshStats();
    }
    
    lastCompanyRef.current = currentCompanyId;
  }, [selectedCompany?.id, refreshStats]);
  
  // Cache management functions
  const clearAll = useCallback(() => {
    setIsManaging(true);
    try {
      pageCache.clear();
      refreshStats();
      console.log('[PageCacheContext] Cleared all cache data');
    } finally {
      setIsManaging(false);
    }
  }, [refreshStats]);
  
  const clearCompany = useCallback(() => {
    if (!selectedCompany?.id) return;
    
    setIsManaging(true);
    try {
      pageCache.clearCompany(selectedCompany.id);
      refreshStats();
      console.log(`[PageCacheContext] Cleared cache for company ${selectedCompany.id}`);
    } finally {
      setIsManaging(false);
    }
  }, [selectedCompany?.id, refreshStats]);
  
  const clearPageType = useCallback((pageType: PageType) => {
    setIsManaging(true);
    try {
      pageCache.clearPageType(pageType);
      refreshStats();
      console.log(`[PageCacheContext] Cleared cache for page type ${pageType}`);
    } finally {
      setIsManaging(false);
    }
  }, [refreshStats]);
  
  const invalidate = useCallback((pageType?: PageType, companyId?: string) => {
    invalidateCache(pageType, companyId || selectedCompany?.id);
    refreshStats();
    console.log(`[PageCacheContext] Invalidated cache for ${pageType || 'all'} / ${companyId || selectedCompany?.id || 'all'}`);
  }, [selectedCompany?.id, refreshStats]);
  
  const getCacheHitRate = useCallback(() => {
    return stats.hitRate;
  }, [stats.hitRate]);
  
  const getCacheHealth = useCallback(() => {
    const { totalEntries, totalSize, hitRate } = stats;
    const maxSize = CACHE_CONFIG.MAX_CACHE_SIZE;
    const maxEntries = CACHE_CONFIG.MAX_ENTRIES;
    
    const sizeRatio = totalSize / maxSize;
    const entriesRatio = totalEntries / maxEntries;
    
    // Critical thresholds
    if (sizeRatio > 0.9 || entriesRatio > 0.9) {
      return {
        status: 'critical' as const,
        message: 'Cache is nearly full and needs immediate cleanup',
        recommendations: [
          'Clear old cache data',
          'Reduce cache expiry times',
          'Consider clearing company-specific data'
        ]
      };
    }
    
    // Warning thresholds
    if (sizeRatio > 0.7 || entriesRatio > 0.7 || hitRate < 30) {
      return {
        status: 'warning' as const,
        message: hitRate < 30 ? 'Low cache hit rate detected' : 'Cache is getting large',
        recommendations: hitRate < 30 
          ? ['Check if data is being properly cached', 'Review cache expiry settings']
          : ['Monitor cache growth', 'Consider periodic cleanup']
      };
    }
    
    // Healthy cache
    return {
      status: 'healthy' as const,
      message: 'Cache is operating optimally',
      recommendations: ['Continue monitoring cache performance']
    };
  }, [stats]);
  
  // Preload navigation function (placeholder for future enhancement)
  const preloadNavigation = useCallback((targetPages: PageType[]) => {
    if (!selectedCompany?.id) return;
    
    console.log(`[PageCacheContext] Preloading requested for pages: ${targetPages.join(', ')}`);
    // TODO: Implement smart preloading based on user navigation patterns
    // This would involve background fetching of likely-to-be-visited pages
  }, [selectedCompany?.id]);
  
  // Automatic cache maintenance
  useEffect(() => {
    const performMaintenance = () => {
      const health = getCacheHealth();
      
      if (health.status === 'critical') {
        console.warn('[PageCacheContext] Critical cache state detected, performing automatic cleanup');
        // Auto-cleanup the oldest 20% of entries
        setIsManaging(true);
        try {
          // Let the cache manager handle its own cleanup
          pageCache['performCleanup']();
          refreshStats();
        } finally {
          setIsManaging(false);
        }
      }
    };
    
    // Check cache health every 5 minutes
    const interval = setInterval(performMaintenance, 5 * 60 * 1000);
    
    // Initial health check
    performMaintenance();
    
    return () => clearInterval(interval);
  }, [getCacheHealth, refreshStats]);
  
  // Development helpers
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Add cache context to window for debugging
      (window as any).__SERPLEXITY_CACHE_CONTEXT__ = {
        stats: () => stats,
        health: () => getCacheHealth(),
        clearAll,
        clearCompany,
        clearPageType,
        invalidate
      };
    }
  }, [stats, getCacheHealth, clearAll, clearCompany, clearPageType, invalidate]);
  
  const value: CacheContextValue = {
    stats,
    isManaging,
    refreshStats,
    clearAll,
    clearCompany,
    clearPageType,
    invalidate,
    preloadNavigation,
    getCacheHitRate,
    getCacheHealth
  };
  
  return (
    <PageCacheContext.Provider value={value}>
      {children}
    </PageCacheContext.Provider>
  );
};

/**
 * Hook to access page cache context
 */
export const usePageCacheContext = (): CacheContextValue => {
  const context = useContext(PageCacheContext);
  if (!context) {
    throw new Error('usePageCacheContext must be used within a PageCacheProvider');
  }
  return context;
};

/**
 * Higher-order component to wrap components with cache management
 */
export function withCacheManagement<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => {
    return (
      <PageCacheProvider>
        <Component {...props} />
      </PageCacheProvider>
    );
  };
  
  WrappedComponent.displayName = `withCacheManagement(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

/**
 * Hook for automatic cache invalidation on data mutations
 */
export function useAutoInvalidate() {
  const { invalidate } = usePageCacheContext();
  const { selectedCompany } = useCompany();
  
  const invalidateOnMutation = useCallback((
    pageTypes: PageType[] = [],
    companyId?: string
  ) => {
    const targetCompanyId = companyId || selectedCompany?.id;
    
    pageTypes.forEach(pageType => {
      invalidate(pageType, targetCompanyId);
    });
    
    if (pageTypes.length === 0) {
      // Invalidate all if no specific page types provided
      invalidate(undefined, targetCompanyId);
    }
  }, [invalidate, selectedCompany?.id]);
  
  return { invalidateOnMutation };
}