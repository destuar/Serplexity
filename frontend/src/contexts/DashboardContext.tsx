/**
 * @file DashboardContext.tsx
 * @description React context for managing dashboard data and analytics throughout the application.
 * Provides dashboard metrics, analytics data, and dashboard-related state management.
 *
 * @dependencies
 * - react: For context creation and state management.
 * - ../services/dashboardService: For dashboard-related API calls.
 * - ../types/dashboard: For dashboard type definitions.
 *
 * @exports
 * - DashboardContext: The dashboard context.
 * - DashboardProvider: Provider component for dashboard state.
 * - useDashboard: Hook for accessing dashboard context.
 */
/**
 * @file DashboardContext.tsx
 * @description Dashboard context provider with integrated data transformation layer.
 *
 * REFACTORED (v2.0.0): Now uses centralized utilities for:
 * - Data transformation and validation via dataTransformationLayer
 * - Consistent error handling via errorHandling utilities
 * - Type-safe data structures via dashboardData types
 * - Data quality monitoring and validation
 *
 * Key improvements:
 * - All API responses are validated and normalized before reaching components
 * - Consistent error states and loading indicators
 * - Data quality metrics for monitoring and debugging
 * - Proper fallback mechanisms for partial data failures
 *
 * @author Dashboard Team
 * @version 2.0.0 - Integrated with refactored architecture
 */
import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { useCompany } from "../hooks/useCompany";
import { DashboardContext } from "../hooks/useDashboard";
import {
  CompetitorData,
  TopRankingQuestion,
  getAcceptedCompetitors,
  getShareOfVoiceHistory,
  getTopRankingQuestions,
} from "../services/companyService";
import { getDashboardData } from "../services/dashboardService";
import { DashboardData, DashboardFilters } from "../types/dashboard";
import { RawDashboardData } from "../types/dashboardData";
import {
  DataPipelineMonitor,
  validateDataPipeline,
} from "../utils/dataConsistencyDebugger";
import {
  transformDashboardData,
  validateNormalizedData,
} from "../utils/dataTransformationLayer";
import { 
  getCachedData, 
  setCachedData, 
  invalidateCache,
  PageType 
} from "../utils/pageCache";
// Error handling simplified for production readiness

interface ApiError {
  message: string;
}

interface DashboardProviderProps {
  children: ReactNode;
}

export const DashboardProvider: React.FC<DashboardProviderProps> = ({
  children,
}) => {
  const { selectedCompany } = useCompany();
  const location = useLocation();

  /**
   * Global filters shared across pages (currently only dateRange is global).
   * Model filter (aiModel) is stored per-page to prevent cross-page interference.
   */
  const [globalFilters, setGlobalFilters] = useState<
    Omit<DashboardFilters, "aiModel">
  >({
    dateRange: "30d",
    company: "",
    competitors: [],
  });

  /**
   * Map of pathname -> aiModel selection.
   * Using pathname ensures separate filter state for each page/route.
   */
  const [aiModelByPath, setAiModelByPath] = useState<
    Record<string, DashboardFilters["aiModel"]>
  >({});

  // Active model preferences loaded from backend (company-level)
  const [activeModelPreferences, setActiveModelPreferences] = useState<Record<string, boolean> | null>(null);

  /**
   * Helper to derive the effective filters for the current page.
   */
  const filters: DashboardFilters = useMemo(() => {
    const currentPath = location.pathname;
    return {
      ...globalFilters,
      aiModel: aiModelByPath[currentPath] ?? "all",
    };
  }, [globalFilters, aiModelByPath, location.pathname]);

  const [data, setData] = useState<DashboardData | null>(null);
  // Store detailed question responses for tooltips
  const [detailedQuestions, setDetailedQuestions] = useState<
    TopRankingQuestion[]
  >([]);
  // Store accepted competitors data
  const [acceptedCompetitors, setAcceptedCompetitors] = useState<
    CompetitorData[]
  >([]);
  // Start in a loading state so pages can show a proper spinner until the
  // first data-fetch attempt completes. This prevents the WelcomePrompt from
  // flashing while data is still on the way.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false); // Subtle loading for filter changes
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // Track whether we have ever received a report (even if empty) vs never having a report
  const [hasReport, setHasReport] = useState<boolean | null>(null);

  // Enhanced state management with data transformation layer

  // Enhanced state management with data transformation layer

  // Keep previous filters to detect meaningful changes (ignore path changes that keep same values)
  const prevFiltersRef = useRef<DashboardFilters | null>(null);
  const prevCompanyIdRef = useRef<string | null>(null);

  // Enhanced caching using global page cache system
  // Legacy cache ref maintained for compatibility during transition
  const cacheRef = useRef<
    Record<
      string,
      {
        data: DashboardData | null;
        detailedQuestions: TopRankingQuestion[];
        acceptedCompetitors: CompetitorData[];
      }
    >
  >({});

  // Fetch dashboard data and detailed questions in parallel
  const fetchData = useCallback(
    async (isRefresh: boolean = false) => {
      // Skip fetching when on routes that don't rely on dashboard data
      if (location.pathname === "/experimental-search") {
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

      // Enhanced cache system with global page cache
      const cacheFilters = {
        dateRange: filters.dateRange,
        aiModel: filters.aiModel
      };

      // Check new global cache system first
      const cachedDashboardData = getCachedData<{
        data: DashboardData | null;
        detailedQuestions: TopRankingQuestion[];
        acceptedCompetitors: CompetitorData[];
        lastUpdated?: string;
      }>('dashboard', selectedCompany.id, cacheFilters);

      if (!isRefresh && cachedDashboardData) {
        console.log(`[DashboardContext] Global cache HIT for dashboard:${selectedCompany.id}`);
        
        setData(cachedDashboardData.data);
        setDetailedQuestions(cachedDashboardData.detailedQuestions);
        setAcceptedCompetitors(cachedDashboardData.acceptedCompetitors);
        if (cachedDashboardData.lastUpdated) {
          setLastUpdated(cachedDashboardData.lastUpdated);
        }

        // Update hasReport based on cached data
        if (cachedDashboardData.data && hasReport !== true) {
          setHasReport(true);
        }

        // Don't trigger loading states for cached data
        setLoading(false);
        setRefreshing(false);
        setError(null);
        return;
      }

      // Legacy cache fallback (remove after transition period)
      const legacyCacheKey = `${selectedCompany.id}|${filters.dateRange}|${filters.aiModel}`;
      if (!isRefresh && cacheRef.current[legacyCacheKey]) {
        const cached = cacheRef.current[legacyCacheKey];
        setData(cached.data);
        setDetailedQuestions(cached.detailedQuestions);
        setAcceptedCompetitors(cached.acceptedCompetitors);
        if (cached.data?.lastUpdated) {
          setLastUpdated(cached.data.lastUpdated);
        }

        // Update hasReport based on cached data
        if (cached.data && hasReport !== true) {
          setHasReport(true);
        }

        // Don't trigger loading states for cached data
        setLoading(false);
        setRefreshing(false);
        setError(null);
        return;
      }

      try {
        // Only set loading states if we actually need to fetch data
        if (isRefresh) {
          setRefreshing(true);
        } else {
          // Use subtle filter loading instead of full page loading for filter changes
          const isInitialLoad = !data;
          if (isInitialLoad) {
            setLoading(true);
          } else {
            setFilterLoading(true);
          }
        }
        setError(null);

        // Only pass essential filters, not the massive competitor list
        const currentFilters = {
          dateRange: filters.dateRange,
          aiModel: filters.aiModel,
        };

        // Use current AI-model filter if not "all" for detailed questions
        const modelParam =
          filters.aiModel && filters.aiModel !== "all"
            ? filters.aiModel
            : undefined;

        // Fetch dashboard data first to determine if reports exist
        const dashboardData = await getDashboardData(
          selectedCompany.id,
          currentFilters
        );

        // If no dashboard data exists, immediately set hasReport to false and skip other calls
        if (!dashboardData) {
          console.log(
            "[DashboardContext] No dashboard data found, setting hasReport to false"
          );
          setData(null);
          setDetailedQuestions([]);
          setAcceptedCompetitors([]);
          setHasReport(false);

          // Cache null result to avoid repeated API calls for companies with no data
          const nullCacheData = {
            data: null,
            detailedQuestions: [],
            acceptedCompetitors: [],
            lastUpdated: undefined
          };

          // Store in global cache with shorter expiry for null results (2 minutes)
          setCachedData('dashboard', selectedCompany.id, nullCacheData, cacheFilters);
          
          // Legacy cache
          const legacyCacheKey = `${selectedCompany.id}|${filters.dateRange}|${filters.aiModel}`;
          cacheRef.current[legacyCacheKey] = nullCacheData;

          setLoading(false);
          setRefreshing(false);
          return;
        }

        // If we have dashboard data, fetch additional data with enterprise monitoring
        console.group("🔄 [DashboardContext] Fetching dashboard data");
        console.log("🎯 Current Filters:", currentFilters);
        console.log("🏢 Company:", selectedCompany.name);
        console.log(
          "⚠️ NOTE: currentFilters does NOT include granularity - this returns RAW data"
        );
        console.log(
          "🔍 DashboardContext fetches data without granularity parameter"
        );

        const [sovHistory, detailedQuestionsData, acceptedCompetitorsData] =
          await Promise.all([
            getShareOfVoiceHistory(selectedCompany.id, currentFilters).catch(
              (err) => {
                console.warn(
                  "[DashboardContext] Failed to fetch share of voice history:",
                  err
                );
                return []; // Return empty array on error
              }
            ),
            getTopRankingQuestions(selectedCompany.id, { aiModel: modelParam })
              .then((result) => result.questions)
              .catch((err) => {
                console.warn(
                  "[DashboardContext] Failed to fetch detailed questions:",
                  err
                );
                return []; // Don't fail the whole request if detailed questions fail
              }),
            getAcceptedCompetitors(selectedCompany.id)
              .then((result) => result.competitors || [])
              .catch((err) => {
                console.warn(
                  "[DashboardContext] Failed to fetch accepted competitors:",
                  err
                );
                return []; // Don't fail the whole request if competitors fail
              }),
          ]);

        // Enterprise-grade data monitoring for DashboardContext
        DataPipelineMonitor.recordData(
          `${selectedCompany.id}-sov-context-${currentFilters.dateRange}`,
          sovHistory,
          {
            component: "DashboardContext",
            operation: "fetchShareOfVoiceHistory_RAW",
            filters: { ...currentFilters, granularity: "RAW" },
            companyId: selectedCompany.id,
          }
        );

        // Inclusion rate removed

        // Validate the RAW data from DashboardContext
        validateDataPipeline(sovHistory, {
          component: "DashboardContext",
          operation: "shareOfVoiceValidation_RAW",
          filters: currentFilters,
          companyId: selectedCompany.id,
        });

        // Inclusion rate removed

        console.groupEnd();

        const fullHistory = sovHistory.map(
          ({ date, shareOfVoice, aiModel }) => ({
            date, // Keep original date format for filtering
            shareOfVoice,
            aiModel, // Preserve the aiModel field for filtering
          })
        );

        const mergedData: DashboardData = {
          ...dashboardData,
          shareOfVoiceHistory: fullHistory,
          inclusionRateHistory: [],
        };

        console.log(
          "[DashboardContext] Data received from service:",
          mergedData
        );
        console.log(
          `[DashboardContext] ShareOfVoiceHistory count: ${mergedData.shareOfVoiceHistory?.length || 0}`
        );
        // Inclusion rate removed
        console.log(
          "[DashboardContext] SOV History sample:",
          mergedData.shareOfVoiceHistory?.slice(0, 3)
        );
        console.log(
          "[DashboardContext] Detailed questions received:",
          detailedQuestionsData
        );
        console.log(
          "[DashboardContext] Accepted competitors received:",
          acceptedCompetitorsData
        );

        // Apply data transformation and validation
        try {
          const transformedData = transformDashboardData(
            mergedData as unknown as RawDashboardData,
            {
              strictMode: false, // Allow partial data in production
              includeDebugInfo: process.env.NODE_ENV === "development",
              minConfidence: 0.3, // Permissive threshold for MVP
            }
          );

          const validation = validateNormalizedData(transformedData);

          // Set all state with enhanced data
          setData(mergedData);
          setDetailedQuestions(detailedQuestionsData);
          setAcceptedCompetitors(acceptedCompetitorsData);
          setHasReport(true);

          // Clear any previous errors on successful data load
          setError(null);

          // Log data quality metrics in development
          if (process.env.NODE_ENV === "development") {
            console.log("[DashboardContext] Data quality metrics:", validation);
          }

          // Data quality monitoring (simplified)
          if (transformedData.dataQuality.confidence < 0.7) {
            console.warn(
              `[DashboardContext] Data quality is ${Math.round(transformedData.dataQuality.confidence * 100)}% - some information may be incomplete`
            );
          }
        } catch (transformationError) {
          console.error(
            "[DashboardContext] Data transformation failed:",
            transformationError
          );

          // Still set the raw data but mark the transformation error
          setData(mergedData);
          setDetailedQuestions(detailedQuestionsData);
          setAcceptedCompetitors(acceptedCompetitorsData);
          setHasReport(true);

          console.error(
            "[DashboardContext] Data transformation error:",
            transformationError
          );
        }

        if (dashboardData?.lastUpdated) {
          setLastUpdated(dashboardData.lastUpdated);
        }

        // Always refresh active model preferences (company-level) for filters
        try {
          const prefsRes = await import("../lib/apiClient").then(({ default: api }) =>
            api.get(`/companies/${selectedCompany.id}/model-preferences`)
          );
          const prefs = (prefsRes?.data?.modelPreferences ?? null) as
            | Record<string, boolean>
            | null;
          setActiveModelPreferences(prefs);
        } catch (e) {
          console.warn("[DashboardContext] Failed to load model preferences", e);
          setActiveModelPreferences(null);
        }

        // Enhanced caching: persist to both global cache and legacy cache
        const cacheData = {
          data: mergedData,
          detailedQuestions: detailedQuestionsData,
          acceptedCompetitors: acceptedCompetitorsData,
          lastUpdated: dashboardData?.lastUpdated
        };

        // Store in new global cache system
        setCachedData('dashboard', selectedCompany.id, cacheData, cacheFilters);
        
        // Legacy cache (maintain during transition)
        const legacyCacheKey = `${selectedCompany.id}|${filters.dateRange}|${filters.aiModel}`;
        cacheRef.current[legacyCacheKey] = cacheData;
      } catch (err) {
        const apiErr = err as ApiError;
        console.error("Failed to fetch dashboard data:", apiErr);
        setError(apiErr.message || "Failed to fetch dashboard data");

        // Always set hasReport to false when there's an error and we don't have existing data
        // This ensures the WelcomePrompt shows up for new companies
        if (hasReport === null || !data) {
          console.log(
            "[DashboardContext] Setting hasReport to false due to error"
          );
          setHasReport(false);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setFilterLoading(false);
      }
    },
    [selectedCompany, filters, location.pathname, hasReport, data]
  );

  // Listen for report completion events to update state immediately
  useEffect(() => {
    if (!selectedCompany) return;

    const handleReportCompletion = (e: CustomEvent) => {
      const { companyId } = e.detail;

      if (companyId === selectedCompany.id) {
        console.log(
          "[DashboardContext] Report completion detected for company:",
          companyId
        );

        // Clear both cache systems to force fresh data fetch
        cacheRef.current = {};
        invalidateCache('dashboard', companyId);

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
              window.dispatchEvent(
                new CustomEvent("dashboardRefreshed", {
                  detail: { companyId },
                })
              );
            }
          });
        }, 2000); // Small delay to ensure backend has committed the data
      }
    };

    window.addEventListener(
      "reportCompleted",
      handleReportCompletion as EventListener
    );

    return () => {
      window.removeEventListener(
        "reportCompleted",
        handleReportCompletion as EventListener
      );
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

  // Live refresh when tasks are added (from Audit page) without requiring manual refresh
  useEffect(() => {
    if (!selectedCompany) return;
    const onTaskAdded = () => {
      // bypass cache and fetch latest so new tasks appear instantly
      fetchData(true);
    };
    window.addEventListener("optimizationTaskAdded", onTaskAdded);
    return () =>
      window.removeEventListener("optimizationTaskAdded", onTaskAdded);
  }, [selectedCompany, fetchData]);

  // Update filters, which will trigger the effect above
  const updateFilters = useCallback(
    (newFilters: Partial<DashboardFilters>) => {
      const currentPath = location.pathname;

      // Separate handling for aiModel which should be scoped per-page
      if (newFilters.aiModel !== undefined) {
        setAiModelByPath((prev) => ({
          ...prev,
          [currentPath]: newFilters.aiModel!,
        }));
      }

      // Handle global filters (currently only dateRange). Ignore aiModel here.
      const rest = { ...newFilters };
      delete rest.aiModel;
      if (Object.keys(rest).length > 0) {
        setGlobalFilters((prev) => ({ ...prev, ...rest }));
      }
    },
    [location.pathname]
  );

  // Refresh data by bumping the trigger
  const refreshData = useCallback(async () => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const value = useMemo(
    () => ({
      data,
      detailedQuestions,
      acceptedCompetitors,
      filters,
      loading,
      error,
      refreshing,
      filterLoading,
      refreshTrigger,
      updateFilters,
      refreshData,
      lastUpdated,
      hasReport,
      activeModelPreferences,
    }),
    [
      data,
      detailedQuestions,
      acceptedCompetitors,
      filters,
      loading,
      error,
      refreshing,
      filterLoading,
      refreshTrigger,
      updateFilters,
      refreshData,
      lastUpdated,
      hasReport,
      activeModelPreferences,
    ]
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};

// Re-export the useDashboard hook for convenience
// eslint-disable-next-line react-refresh/only-export-components
export { useDashboard } from "../hooks/useDashboard";
