import { Calendar, Sparkles, RefreshCw, Loader } from "lucide-react";
import { useState, useEffect } from "react";
import { useCompany } from "../contexts/CompanyContext";
import { useDashboard } from "../hooks/useDashboard";
import { triggerReportGeneration, getReportStatus } from '../services/reportService';
import FilterDropdown from "../components/dashboard/FilterDropdown";
import BrandShareOfVoiceCard from "../components/dashboard/BrandShareOfVoiceCard";
import VisibilityOverTimeCard from "../components/dashboard/VisibilityOverTimeCard";
import SentimentScoreCard from "../components/dashboard/SentimentScoreCard";
import AverageInclusionRateCard from "../components/dashboard/AverageInclusionRateCard";
import AveragePositionCard from "../components/dashboard/AveragePositionCard";
import TopRankingQuestionsCard from "../components/dashboard/TopRankingQuestionsCard";
import RankingsCard from "../components/dashboard/RankingsCard";
import WelcomePrompt from "../components/ui/WelcomePrompt";
import { getModelFilterOptions } from "../types/dashboard";

const OverviewPage = () => {
  const { selectedCompany } = useCompany();
  const { data, filters, loading, refreshing, updateFilters, refreshData, lastUpdated, refreshTrigger } = useDashboard();
  
  // State for the WelcomePrompt's on-demand generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  
  const handleFilterChange = (filterUpdates: { [key: string]: string | string[] }) => {
    updateFilters(filterUpdates);
  };

  const handleRefresh = async () => {
    await refreshData();
  };

  // This function is now only used by the WelcomePrompt for the initial report generation
  const handleGenerateReport = async () => {
    if (!selectedCompany) return;

    setIsGenerating(true);
    setGenerationStatus('Connecting to report pipeline...');
    try {
      const { runId: newRunId, status, message } = await triggerReportGeneration(selectedCompany.id);

      if (message && (status === 'COMPLETED' || status === 'RUNNING' || status === 'PENDING')) {
        setGenerationStatus('A recent report is already available or in progress...');
      } else {
        setGenerationStatus('Initializing report generation pipeline...');
      }
      
      setRunId(newRunId);
    } catch (error) {
        console.error("Failed to start report generation:", error);
        setIsGenerating(false);
        setGenerationStatus('Failed to start report generation.');
    }
  };
  
  // Polling logic for the initial report generation from WelcomePrompt
  useEffect(() => {
    if (!isGenerating || !runId) {
      return;
    }

    const poll = setInterval(async () => {
      try {
        const statusRes = await getReportStatus(runId);
        
        // Keep the original stepStatus for percentage extraction
        setGenerationStatus(statusRes.stepStatus || 'Processing data...');
        
        if (statusRes.status === 'COMPLETED' || statusRes.status === 'FAILED') {
          setIsGenerating(false);
          setRunId(null);
          setGenerationStatus(statusRes.status === 'COMPLETED' ? 'Report generated successfully' : 'Report generation failed');
          if (statusRes.status === 'COMPLETED') {
            // Refresh the dashboard data
            await refreshData();
          }
        }
      } catch (pollError) {
        console.error("Status polling failed:", pollError);
        setIsGenerating(false);
        setRunId(null);
        setGenerationStatus('Connection error during generation');
      }
    }, 2000); // Poll every 2 seconds for more responsive updates

    return () => clearInterval(poll); // Cleanup on unmount or when dependencies change
  }, [isGenerating, runId, refreshData]);

  const dateRangeOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' },
  ];

  const aiModelOptions = getModelFilterOptions();

  // Debug logging for the data state
  console.log('[OverviewPage] Current data state:', data);
  console.log('[OverviewPage] Data is null?', data === null);
  console.log('[OverviewPage] Data is undefined?', data === undefined);
  console.log('[OverviewPage] Data keys length:', data ? Object.keys(data).length : 'N/A');
  console.log('[OverviewPage] Loading state:', loading);
  console.log('[OverviewPage] Should show welcome?', !data || Object.keys(data).length === 0);

  return (
    <div className="h-full flex flex-col relative">
      {/* Header Section - Only show when there's existing data */}
      {data && (
        <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
            {lastUpdated && (
              <p className="text-sm text-gray-500 mt-1">
                Last updated: {new Date(lastUpdated).toLocaleString()}
              </p>
            )}
          </div>
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
              className="flex items-center justify-center w-full lg:w-auto gap-2 px-4 py-2 bg-[#7762ff] text-white rounded-lg hover:bg-[#6650e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium col-span-2"
            >
              {refreshing ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  <span className="whitespace-nowrap">Refreshing...</span>
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  <span className="whitespace-nowrap">Refresh data</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
      
      {/* Dashboard Grid - Dynamic Height with Custom Rows */}
      {loading && !data ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <Loader className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-gray-600">Loading dashboard data...</p>
          </div>
        </div>
      ) : !data || Object.keys(data).length === 0 ? (
        <WelcomePrompt
          onGenerateReport={handleGenerateReport}
          isGenerating={isGenerating}
          generationStatus={generationStatus}
        />
      ) : (
        <div className="flex-1 min-h-0 p-1">
          {/* Dashboard Grid - Responsive Layout */}
          <div className="h-full w-full">
            {/* Mobile: Stack all cards vertically */}
            <div className="lg:hidden h-full overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4 min-h-[200px]">
                <BrandShareOfVoiceCard />
                <VisibilityOverTimeCard />
              </div>
              <div className="grid grid-cols-2 gap-4 min-h-[200px]">
                <AverageInclusionRateCard />
                <AveragePositionCard />
              </div>
              <div className="min-h-[300px]">
                <SentimentScoreCard key={`sentiment-overview-mobile-${filters.aiModel}-${filters.dateRange}-${refreshTrigger}`} />
              </div>
              <div className="min-h-[00px]">
                <TopRankingQuestionsCard />
              </div>
              <div className="min-h-[200px]">
                <RankingsCard />
              </div>
            </div>

            {/* Desktop: Grid Template Areas Layout - 48 columns × 24 rows for maximum control */}
            <div className="hidden lg:grid h-full w-full gap-4" style={{
              gridTemplateColumns: 'repeat(48, 1fr)',
              gridTemplateRows: 'repeat(14, minmax(30px, 1fr))',
              gridTemplateAreas: `
                "m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
                "m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
                "m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
                "m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
                "m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
                "m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
                "m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
                "m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
                "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
                "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
                "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
                "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
                "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
                "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
              `
            }}>
              {/* Top-left metric (Share of Voice) */}
              <div style={{ gridArea: 'm1' }}>
                <BrandShareOfVoiceCard />
              </div>
              
              {/* Top-right metric (Visibility) */}
              <div style={{ gridArea: 'm2' }}>
                <VisibilityOverTimeCard />
              </div>
              
              {/* Bottom-left metric (Inclusion Rate) */}
              <div style={{ gridArea: 'm3' }}>
                <AverageInclusionRateCard />
              </div>
              
              {/* Bottom-right metric (Position) */}
              <div style={{ gridArea: 'm4' }}>
                <AveragePositionCard />
              </div>
              
              {/* Sentiment card - spans right side, 8 rows */}
              <div style={{ gridArea: 's1' }}>
                <SentimentScoreCard key={`sentiment-overview-${filters.aiModel}-${filters.dateRange}-${refreshTrigger}`} />
              </div>

              {/* Questions card - spans left bottom, 4 rows */}
              <div style={{ gridArea: 'q1' }}>
                <TopRankingQuestionsCard />
              </div>
              
              {/* Rankings card - spans right bottom, 4 rows */}
              <div style={{ gridArea: 'r1' }}>
                <RankingsCard />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OverviewPage; 