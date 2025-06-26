import React, { useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { DashboardData, DashboardFilters } from '../types/dashboard';
import { getDashboardData } from '../services/dashboardService';
import { useCompany } from '../hooks/useCompany';
import { DashboardContext } from '../hooks/useDashboard';
import { useLocation } from 'react-router-dom';

interface ApiError {
  message: string;
}

interface DashboardProviderProps {
  children: ReactNode;
}

export const DashboardProvider: React.FC<DashboardProviderProps> = ({ children }) => {
  const { selectedCompany } = useCompany();
  const location = useLocation();
  
  /**
   * Global filters shared across pages (currently only dateRange is global).
   * Model filter (aiModel) is stored per-page to prevent cross-page interference.
   */
  const [globalFilters, setGlobalFilters] = useState<Omit<DashboardFilters, 'aiModel'>>({
    dateRange: '30d',
    company: '',
    competitors: [],
  });

  /**
   * Map of pathname -> aiModel selection.
   * Using pathname ensures separate filter state for each page/route.
   */
  const [aiModelByPath, setAiModelByPath] = useState<Record<string, DashboardFilters['aiModel']>>({});

  /**
   * Helper to derive the effective filters for the current page.
   */
  const filters: DashboardFilters = useMemo(() => {
    const currentPath = location.pathname;
    return {
      ...globalFilters,
      aiModel: aiModelByPath[currentPath] ?? 'all',
    };
  }, [globalFilters, aiModelByPath, location.pathname]);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Keep previous filters to detect meaningful changes (ignore path changes that keep same values)
  const prevFiltersRef = useRef<DashboardFilters | null>(null);

  // Fetch dashboard data
  const fetchData = useCallback(async (isRefresh: boolean = false) => {
    if (!selectedCompany) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Only pass essential filters, not the massive competitor list
      const currentFilters = {
        dateRange: filters.dateRange,
        aiModel: filters.aiModel,
      };

      const dashboardData = await getDashboardData(selectedCompany.id, currentFilters);

      console.log('[DashboardContext] Data received from service:', dashboardData);
      console.log('[DashboardContext] Data type:', typeof dashboardData);
      console.log('[DashboardContext] Data is null?', dashboardData === null);
      console.log('[DashboardContext] Data keys count:', dashboardData ? Object.keys(dashboardData).length : 0);

      setData(dashboardData);
      if (dashboardData?.lastUpdated) {
        setLastUpdated(dashboardData.lastUpdated);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      console.error('Failed to fetch dashboard data:', apiErr);
      setError(apiErr.message || 'Failed to fetch dashboard data');
      // Keep existing data on error to avoid blanking the screen
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCompany, filters]);

  // Fetch on meaningful filter changes (dateRange/aiModel) or company switch
  useEffect(() => {
    if (!selectedCompany) return;

    const prev = prevFiltersRef.current;
    const filtersChanged =
      !prev ||
      prev.dateRange !== filters.dateRange ||
      prev.aiModel !== filters.aiModel;

    if (filtersChanged) {
      fetchData();
    }
    // Always sync the ref to current filters so future comparisons are accurate
    prevFiltersRef.current = filters;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany, filters]);

  // Fetch when user explicitly triggers a refresh
  useEffect(() => {
    if (!selectedCompany) return;
    if (refreshTrigger > 0) {
      fetchData(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger, selectedCompany]);

  // Update filters, which will trigger the effect above
  const updateFilters = useCallback((newFilters: Partial<DashboardFilters>) => {
    const currentPath = location.pathname;

    // Separate handling for aiModel which should be scoped per-page
    if (newFilters.aiModel !== undefined) {
      setAiModelByPath(prev => ({ ...prev, [currentPath]: newFilters.aiModel! }));
    }

    // Handle global filters (currently only dateRange). Ignore aiModel here.
    const { aiModel: _ignored, ...rest } = newFilters;
    if (Object.keys(rest).length > 0) {
      setGlobalFilters(prev => ({ ...prev, ...rest }));
    }
  }, [location.pathname]);

  // Refresh data by bumping the trigger
  const refreshData = useCallback(async () => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const value = useMemo(() => ({
    data,
    filters,
    loading,
    error,
    refreshing,
    refreshTrigger,
    updateFilters,
    refreshData,
    lastUpdated,
  }), [
    data,
    filters,
    loading,
    error,
    refreshing,
    refreshTrigger,
    updateFilters,
    refreshData,
    lastUpdated,
  ]);

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};

// Re-export the useDashboard hook for convenience
// eslint-disable-next-line react-refresh/only-export-components
export { useDashboard } from '../hooks/useDashboard'; 