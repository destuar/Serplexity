import { useState, useEffect, useCallback } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { useDashboard } from './useDashboard';
import { getAllModelsData } from '../services/dashboardService';
import { DashboardData } from '../types/dashboard';

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
      const { aiModel: _ignored, ...filtersWithoutAiModel } = filters;
      const data = await getAllModelsData(selectedCompany.id, filtersWithoutAiModel);
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