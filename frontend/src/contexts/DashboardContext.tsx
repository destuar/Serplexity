import React, { useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { DashboardData, DashboardFilters } from '../types/dashboard';
import { getDashboardData } from '../services/dashboardService';
import { useCompany } from '../hooks/useCompany';
import { DashboardContext } from '../hooks/useDashboard';
import { useLocation } from 'react-router-dom';
import { getShareOfVoiceHistory, getTopRankingQuestions, TopRankingQuestion } from '../services/companyService';

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
  // Store detailed question responses for tooltips
  const [detailedQuestions, setDetailedQuestions] = useState<TopRankingQuestion[]>([]);
  // Start in a loading state so pages can show a proper spinner until the
  // first data-fetch attempt completes. This prevents the WelcomePrompt from
  // flashing while data is still on the way.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // Track whether we have ever received a report (even if empty) vs never having a report
  const [hasReport, setHasReport] = useState<boolean | null>(null);

  // Keep previous filters to detect meaningful changes (ignore path changes that keep same values)
  const prevFiltersRef = useRef<DashboardFilters | null>(null);
  const prevCompanyIdRef = useRef<string | null>(null);

  // Simple in-memory cache for dashboard responses keyed by company & filters
  const cacheRef = useRef<Record<string, { data: DashboardData | null; detailedQuestions: TopRankingQuestion[] }>>({});

  // Fetch dashboard data and detailed questions in parallel
  const fetchData = useCallback(async (isRefresh: boolean = false) => {
    // Skip fetching when on routes that don't rely on dashboard data
    if (location.pathname === '/experimental-search') {
      // Nothing to load for this route – immediately clear the loading state.
      setLoading(false);
      return;
    }

    if (!selectedCompany) {
      // No company selected means we have nothing to fetch. Clear the loading
      // indicator so downstream components (like CompanyGuard) can take over.
      setLoading(false);
      return;
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Build cache key and check for warm data
      const cacheKey = `${selectedCompany.id}|${filters.dateRange}|${filters.aiModel}`;

      if (!isRefresh && cacheRef.current[cacheKey]) {
        const cached = cacheRef.current[cacheKey];
        setData(cached.data);
        setDetailedQuestions(cached.detailedQuestions);
        if (cached.data?.lastUpdated) {
          setLastUpdated(cached.data.lastUpdated);
        }
        
        // Update hasReport based on cached data
        if (cached.data && hasReport !== true) {
          setHasReport(true);
        }
        
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Only pass essential filters, not the massive competitor list
      const currentFilters = {
        dateRange: filters.dateRange,
        aiModel: filters.aiModel,
      };

      // Use current AI-model filter if not "all" for detailed questions
      const modelParam = filters.aiModel && filters.aiModel !== 'all' ? filters.aiModel : undefined;

      // Fetch all data in parallel
      const [dashboardData, sovHistory, detailedQuestionsData] = await Promise.all([
        getDashboardData(selectedCompany.id, currentFilters),
        getShareOfVoiceHistory(selectedCompany.id, currentFilters),
        getTopRankingQuestions(selectedCompany.id, { aiModel: modelParam })
          .then(result => result.questions)
          .catch(err => {
            console.warn('[DashboardContext] Failed to fetch detailed questions:', err);
            return []; // Don't fail the whole request if detailed questions fail
          })
      ]);

      const fullHistory = sovHistory.map(({ date, shareOfVoice, aiModel }) => ({
        date, // Keep original date format for filtering
        shareOfVoice,
        aiModel, // Preserve the aiModel field for filtering
      }));

      const mergedData: DashboardData | null = dashboardData
        ? { ...dashboardData, shareOfVoiceHistory: fullHistory }
        : null;

      console.log('[DashboardContext] Data received from service:', mergedData);
      console.log('[DashboardContext] Detailed questions received:', detailedQuestionsData);

      setData(mergedData);
      setDetailedQuestions(detailedQuestionsData);
      
      // Update hasReport based on new data
      if (mergedData) {
        setHasReport(true);
      } else if (hasReport === null) {
        // Only set false the first time when we know no report exists
        setHasReport(false);
      }
      
      if (dashboardData?.lastUpdated) {
        setLastUpdated(dashboardData.lastUpdated);
      }

      // Persist to cache
      cacheRef.current[cacheKey] = {
        data: mergedData,
        detailedQuestions: detailedQuestionsData
      };
    } catch (err) {
      const apiErr = err as ApiError;
      console.error('Failed to fetch dashboard data:', apiErr);
      setError(apiErr.message || 'Failed to fetch dashboard data');
      
      // On error, don't flip hasReport back to false if we have ever seen a report.
      if (data === null && hasReport === null) {
        setHasReport(false);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCompany, filters, location.pathname, hasReport, data]);

  // Listen for report completion events to update state immediately
  useEffect(() => {
    if (!selectedCompany) return;

    const handleReportCompletion = (e: CustomEvent) => {
      const { companyId } = e.detail;
      
      if (companyId === selectedCompany.id) {
        console.log('[DashboardContext] Report completion detected for company:', companyId);
        
        // Clear cache to force fresh data fetch
        cacheRef.current = {};
        
        // Update hasReport immediately
        setHasReport(true);
        
        // Trigger data refresh to load the new report
        setTimeout(() => {
          fetchData(true).then(() => {
            // Mark dashboard as refreshed in completion state
            const completionKey = `serplexity_completion_state_${companyId}`;
            const storedCompletion = localStorage.getItem(completionKey);
            if (storedCompletion) {
              const completion = JSON.parse(storedCompletion);
              completion.dashboardRefreshed = true;
              localStorage.setItem(completionKey, JSON.stringify(completion));
              
              // Dispatch event to notify other components
              window.dispatchEvent(new CustomEvent('dashboardRefreshed', {
                detail: { companyId }
              }));
            }
          });
        }, 2000); // Small delay to ensure backend has committed the data
      }
    };

    window.addEventListener('reportCompleted', handleReportCompletion as EventListener);
    
    return () => {
      window.removeEventListener('reportCompleted', handleReportCompletion as EventListener);
    };
  }, [selectedCompany, fetchData]);

  // Fetch on meaningful filter changes (dateRange/aiModel) or company switch
  useEffect(() => {
    if (!selectedCompany) return;

    const prevFilters = prevFiltersRef.current;
    const prevCompanyId = prevCompanyIdRef.current;

    const filtersChanged =
      !prevFilters ||
      prevFilters.dateRange !== filters.dateRange ||
      prevFilters.aiModel !== filters.aiModel;

    const companyChanged = prevCompanyId !== selectedCompany.id;

    if (filtersChanged || companyChanged) {
      fetchData();
    }

    // Update refs for next comparison
    prevFiltersRef.current = filters;
    prevCompanyIdRef.current = selectedCompany.id;
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
    const rest = { ...newFilters };
    delete rest.aiModel;
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
    detailedQuestions,
    filters,
    loading,
    error,
    refreshing,
    refreshTrigger,
    updateFilters,
    refreshData,
    lastUpdated,
    hasReport,
  }), [
    data,
    detailedQuestions,
    filters,
    loading,
    error,
    refreshing,
    refreshTrigger,
    updateFilters,
    refreshData,
    lastUpdated,
    hasReport,
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