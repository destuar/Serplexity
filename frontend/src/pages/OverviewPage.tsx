/**
 * @file OverviewPage.tsx
 * @description Main dashboard overview page that displays key metrics and analytics.
 * Provides comprehensive view of AI visibility performance and insights.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - lucide-react: For icons.
 * - ../contexts/DashboardContext: For dashboard data.
 * - ../components/dashboard/*: For dashboard components.
 *
 * @exports
 * - OverviewPage: The main overview page component.
 */
import { Calendar, Sparkles, RefreshCw, Loader } from "lucide-react";
// Note: dashboardClasses import removed as it's unused
import { useCompany } from "../contexts/CompanyContext";
import { useDashboard } from "../hooks/useDashboard";
import FilterDropdown from "../components/dashboard/FilterDropdown";
import MetricsOverTimeCard from "../components/dashboard/MetricsOverTimeCard";
import SentimentScoreDisplayCard from "../components/dashboard/SentimentScoreDisplayCard";
import TopRankingQuestionsCard from "../components/dashboard/TopRankingQuestionsCard";
import RankingsCard from "../components/dashboard/RankingsCard";
import WelcomePrompt from "../components/ui/WelcomePrompt";
import BlankLoadingState from "../components/ui/BlankLoadingState";
import LiquidGlassSpinner from "../components/ui/LiquidGlassSpinner";
import { getModelFilterOptions } from "../types/dashboard";
import { useReportGeneration } from "../hooks/useReportGeneration";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useEmbeddedPage } from "../hooks/useEmbeddedPage";
import { useNavigation } from "../hooks/useNavigation";
import { useEffect } from "react";

// Import sentiment page components
// import SentimentOverTimeCard from "../components/dashboard/SentimentOverTimeCard";
// import SentimentDetailsCard from "../components/dashboard/SentimentDetailsCard";
import ModelComparisonPage from "./ModelComparisonPage";
import SentimentAnalysisPage from "./SentimentAnalysisPage";

const OverviewPage = () => {
  const { selectedCompany } = useCompany();
  const { data, filters, loading, refreshing, filterLoading, updateFilters, refreshData, lastUpdated, refreshTrigger, hasReport } = useDashboard();
  
  const { 
    isGenerating, 
    generationStatus, 
    progress, 
    generateReport, 
    isButtonDisabled, 
    generationState, 
     
  } = useReportGeneration(selectedCompany);
  const isTallerScreen = useMediaQuery('(min-height: 1080px)');
  const { embeddedPage, openEmbeddedPage, closeEmbeddedPage, isEmbedded } = useEmbeddedPage('Dashboard');
  const { setBreadcrumbs, registerEmbeddedPageCloser, unregisterEmbeddedPageCloser } = useNavigation();



  // Set initial breadcrumb
  useEffect(() => {
    if (!isEmbedded) {
      setBreadcrumbs([{ label: 'Dashboard' }]);
    }
  }, [isEmbedded, setBreadcrumbs]);

  // Register/unregister embedded page closer
  useEffect(() => {
    registerEmbeddedPageCloser('/dashboard', closeEmbeddedPage);
    return () => unregisterEmbeddedPageCloser('/dashboard');
  }, [registerEmbeddedPageCloser, unregisterEmbeddedPageCloser, closeEmbeddedPage]);
  
  const handleFilterChange = (filterUpdates: { [key: string]: string | string[] }) => {
    updateFilters(filterUpdates);
  };

  const handleRefresh = () => {
    refreshData();
  };

  const handleSentimentSeeMore = () => {
    openEmbeddedPage('sentiment', 'Sentiment');
  };

  // const handleModelComparisonSeeMore = () => {
  //   openEmbeddedPage('model-comparison', 'Model Comparison');
  // };

  // Define options before using them
  const dateRangeOptions = [
    { value: '24h', label: 'Last 24 hours' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' },
  ];

  const aiModelOptions = getModelFilterOptions();

  // Render embedded sentiment page
  if (embeddedPage === 'sentiment') {
    return <SentimentAnalysisPage />;
  }

  // Render embedded model comparison page
  if (embeddedPage === 'model-comparison') {
    return <ModelComparisonPage />;
  }

  const cardKey = `overview-${filters.aiModel}-${filters.dateRange}-${refreshTrigger}`;

  // Check if all critical data is loaded
  const isDashboardFullyLoaded = data && 
    data.shareOfVoice !== undefined &&
    data.averageInclusionRate !== undefined &&
    data.averagePosition !== undefined &&
    data.competitorRankings !== undefined &&
    data.topQuestions !== undefined &&
    data.shareOfVoiceHistory !== undefined;

  return (
    <div className="h-full flex flex-col relative">
      {/* Loading State - Show glass spinner until everything is ready */}
      {loading || hasReport === null || (hasReport === true && !isDashboardFullyLoaded) ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <LiquidGlassSpinner size="lg" />
          </div>
        </div>
      ) : hasReport === false ? (
        <WelcomePrompt
          onGenerateReport={generateReport}
          isGenerating={isGenerating}
          generationStatus={generationStatus}
          progress={progress}
          isButtonDisabled={isButtonDisabled}
          generationState={generationState}
        />
      ) : (
        <>
          <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-2">
            <div className="grid grid-cols-2 lg:flex items-center gap-2 w-full lg:w-auto">
              <FilterDropdown
                label="Date Range"
                value={filters.dateRange}
                options={dateRangeOptions}
                onChange={(value) => handleFilterChange({ dateRange: value as string })}
                icon={Calendar}
                disabled={loading || refreshing}
              />
              
              <FilterDropdown
                label="AI Model"
                value={filters.aiModel}
                options={aiModelOptions}
                onChange={(value) => handleFilterChange({ aiModel: value as string })}
                icon={filters.aiModel === 'all' ? Sparkles : undefined}
                disabled={loading || refreshing}
              />
              
              <button 
                onClick={handleRefresh}
                disabled={loading || refreshing}
                className={`flex items-center justify-center w-full lg:w-auto gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium col-span-2 hover:bg-white/85 focus:outline-none focus:ring-2 focus:ring-black`}
              >
                {refreshing ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    <span className="whitespace-nowrap">Refreshing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    <span className="whitespace-nowrap">Refresh Data</span>
                  </>
                )}
              </button>
            </div>
            <div>
              {lastUpdated && data && (
                <p className="text-sm text-gray-500">
                  Last updated: {new Date(lastUpdated).toLocaleString()}
                </p>
              )}
            </div>
          </div>
      
          {!data || Object.keys(data).length === 0 ? (
            <BlankLoadingState message="Processing report data..." />
          ) : (
            <div className="flex-1 min-h-0 p-1 relative">
              {/* Subtle loading overlay for filter changes */}
              {filterLoading && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                  <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-lg px-4 py-2 flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-medium text-gray-700">Updating...</span>
                  </div>
                </div>
              )}
              <div className="h-full w-full">
                <div className="lg:hidden h-full overflow-y-auto space-y-4">
                  <div className="min-h-[400px]">
                    <MetricsOverTimeCard key={`${cardKey}-metrics`} selectedModel={filters.aiModel} />
                  </div>
                  <div className="min-h-[300px]">
                    <SentimentScoreDisplayCard key={`${cardKey}-ss`} selectedModel={filters.aiModel} onSeeMore={handleSentimentSeeMore} />
                  </div>
                  <div className="min-h-[300px]">
                    <TopRankingQuestionsCard key={`${cardKey}-trq`} />
                  </div>
                  <div className="min-h-[200px]">
                    <RankingsCard key={`${cardKey}-rank`} />
                  </div>
                </div>

                <div className="hidden lg:grid h-full w-full gap-4" style={{
                  gridTemplateColumns: 'repeat(48, 1fr)',
                  gridTemplateRows: 'repeat(14, minmax(30px, 1fr))',
                  gridTemplateAreas: isTallerScreen ? `
                    "metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
                    "metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
                    "metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
                    "metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
                    "metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
                    "metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
                    "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
                    "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
                    "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
                    "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
                    "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
                    "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
                    "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
                    "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
                  ` : `
                    "metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
                    "metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
                    "metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
                    "metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
                    "metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
                    "metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
                    "metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
                    "metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
                    "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
                    "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
                    "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
                    "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
                    "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
                    "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
                  `
                }}>
                  <div style={{ gridArea: 'metrics' }}><MetricsOverTimeCard key={`${cardKey}-metrics-desk`} selectedModel={filters.aiModel} /></div>
                  <div style={{ gridArea: 's1' }}><SentimentScoreDisplayCard key={`${cardKey}-ss-desk`} selectedModel={filters.aiModel} onSeeMore={handleSentimentSeeMore} /></div>
                  <div style={{ gridArea: 'q1' }}><TopRankingQuestionsCard key={`${cardKey}-trq-desk`} /></div>
                  <div style={{ gridArea: 'r1' }}><RankingsCard key={`${cardKey}-rank-desk`} /></div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default OverviewPage; 