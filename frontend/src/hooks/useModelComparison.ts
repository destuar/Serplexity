/**
 * @file useModelComparison.ts
 * @description Custom hook for managing model comparison data and operations.
 * Provides model comparison functionality, data fetching, and comparison state management.
 *
 * @dependencies
 * - react: For state management and effects.
 * - ../lib/apiClient: For API communication.
 *
 * @exports
 * - useModelComparison: Hook for model comparison functionality.
 */
import { useState, useEffect, useCallback } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { useDashboard } from './useDashboard';
import { getAllModelsData } from '../services/dashboardService';
import { DashboardData, DashboardFilters } from '../types/dashboard';

export const useModelComparison = () => {
  const { selectedCompany } = useCompany();
  const { filters, hasReport } = useDashboard();
  
  const [comparisonData, setComparisonData] = useState<DashboardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComparisonData = useCallback(async () => {
    if (!selectedCompany || !hasReport) {
      setComparisonData([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use existing dashboard infrastructure - just fetch for all models
      const filtersWithoutAiModel = { ...filters };
      delete (filtersWithoutAiModel as Partial<DashboardFilters>).aiModel;

      const data = await getAllModelsData(selectedCompany.id, filtersWithoutAiModel as Omit<DashboardFilters, 'aiModel'>);
      setComparisonData(data);
    } catch (err) {
      console.error('Failed to fetch model comparison data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch model comparison data');
      setComparisonData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCompany, filters, hasReport]);

  useEffect(() => {
    fetchComparisonData();
  }, [fetchComparisonData]);

  const refreshData = useCallback(() => {
    fetchComparisonData();
  }, [fetchComparisonData]);

  return {
    data: comparisonData,
    loading,
    error,
    refreshData,
  };
}; 