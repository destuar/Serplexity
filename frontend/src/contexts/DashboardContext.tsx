import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useMemo } from 'react';
import { DashboardData, DashboardFilters } from '../types/dashboard';
import { MockDataService } from '../services/mockDataService';
import { useCompany } from './CompanyContext';

interface DashboardContextType {
  data: DashboardData | null;
  filters: DashboardFilters;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  updateFilters: (newFilters: Partial<DashboardFilters>) => void;
  refreshData: () => Promise<void>;
  lastUpdated: string | null;
}

interface DashboardProviderProps {
  children: ReactNode;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

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

      const currentFilters = {
        ...filters,
        company: selectedCompany.name,
        competitors: selectedCompany.competitors.map(c => c.name),
      };

      const dashboardData = isRefresh 
        ? await MockDataService.refreshData(currentFilters, selectedCompany.name)
        : await MockDataService.getDashboardData(currentFilters, selectedCompany.name);

      setData(dashboardData);
      setLastUpdated(dashboardData.lastUpdated);
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err);
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCompany, filters]);

  // Load data when company changes, but not on filter changes
  useEffect(() => {
    if (selectedCompany) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany]);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<DashboardFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Refresh data
  const refreshData = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  const value = useMemo(() => ({
    data,
    filters,
    loading,
    error,
    refreshing,
    updateFilters,
    refreshData,
    lastUpdated,
  }), [
    data,
    filters,
    loading,
    error,
    refreshing,
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

// Hook to use the DashboardContext
export const useDashboard = (): DashboardContextType => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

export default DashboardContext; 