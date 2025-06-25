import React, { useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { DashboardData, DashboardFilters } from '../types/dashboard';
import { getDashboardData } from '../services/dashboardService';
import { useCompany } from '../hooks/useCompany';
import { DashboardContext } from '../hooks/useDashboard';

interface ApiError {
  message: string;
}

interface DashboardProviderProps {
  children: ReactNode;
}

export const DashboardProvider: React.FC<DashboardProviderProps> = ({ children }) => {
  const { selectedCompany } = useCompany();
  
  // Default filters
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: '30d',
    aiModel: 'all',
    company: '',
    competitors: [],
  });

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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

  // Unified effect to fetch data whenever company, filters, or refresh trigger change
  useEffect(() => {
    if (selectedCompany) {
      fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany, filters, refreshTrigger]);

  // Update filters, which will trigger the effect above
  const updateFilters = useCallback((newFilters: Partial<DashboardFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

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