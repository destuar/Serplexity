import { Calendar, Sparkles, RefreshCw, Loader } from "lucide-react";
import { useCompany } from "../contexts/CompanyContext";
import { useDashboard } from "../hooks/useDashboard";
import FilterDropdown from "../components/dashboard/FilterDropdown";
import BrandShareOfVoiceCard from "../components/dashboard/BrandShareOfVoiceCard";
import VisibilityOverTimeCard from "../components/dashboard/VisibilityOverTimeCard";
import SentimentScoreCard from "../components/dashboard/SentimentScoreCard";
import AverageInclusionRateCard from "../components/dashboard/AverageInclusionRateCard";
import AveragePositionCard from "../components/dashboard/AveragePositionCard";
import TopRankingQuestionsCard from "../components/dashboard/TopRankingQuestionsCard";
import RankingsCard from "../components/dashboard/RankingsCard";
import WelcomePrompt from "../components/ui/WelcomePrompt";
import BlankLoadingState from "../components/ui/BlankLoadingState";
import { getModelFilterOptions } from "../types/dashboard";
import { useReportGeneration } from "../hooks/useReportGeneration";

const OverviewPage = () => {
  const { selectedCompany } = useCompany();
  const { data, filters, loading, refreshing, updateFilters, refreshData, lastUpdated, refreshTrigger, hasReport } = useDashboard();
  
  const { isGenerating, generationStatus, generateReport } = useReportGeneration(selectedCompany);
  
  const handleFilterChange = (filterUpdates: { [key: string]: string | string[] }) => {
    updateFilters(filterUpdates);
  };

  const handleRefresh = () => {
    refreshData();
  };

  const dateRangeOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' },
  ];

  const aiModelOptions = getModelFilterOptions();

  const cardKey = `overview-${filters.aiModel}-${filters.dateRange}-${refreshTrigger}`;

  return (
    <div className="h-full flex flex-col relative">
      {/* Header Section - Only show when there's existing data */}
      {loading || hasReport === null ? (
        <BlankLoadingState message="Loading dashboard data..." />
      ) : hasReport === false ? (
        <WelcomePrompt
          onGenerateReport={generateReport}
          isGenerating={isGenerating}
          generationStatus={generationStatus}
        />
      ) : (
        <>
          <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
              {lastUpdated && data && (
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
      
          {!data || Object.keys(data).length === 0 ? (
            <BlankLoadingState message="Processing report data..." />
          ) : (
            <div className="flex-1 min-h-0 p-1">
              <div className="h-full w-full">
                <div className="lg:hidden h-full overflow-y-auto space-y-4">
                  <div className="grid grid-cols-2 gap-4 min-h-[200px]">
                    <BrandShareOfVoiceCard key={`${cardKey}-sov`} />
                    <VisibilityOverTimeCard key={`${cardKey}-vot`} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 min-h-[200px]">
                    <AverageInclusionRateCard key={`${cardKey}-air`} />
                    <AveragePositionCard key={`${cardKey}-ap`} />
                  </div>
                  <div className="min-h-[300px]">
                    <SentimentScoreCard key={`${cardKey}-ss`} />
                  </div>
                  <div className="min-h-[00px]">
                    <TopRankingQuestionsCard key={`${cardKey}-trq`} />
                  </div>
                  <div className="min-h-[200px]">
                    <RankingsCard key={`${cardKey}-rank`} />
                  </div>
                </div>

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
                  <div style={{ gridArea: 'm1' }}><BrandShareOfVoiceCard key={`${cardKey}-sov-desk`} /></div>
                  <div style={{ gridArea: 'm2' }}><VisibilityOverTimeCard key={`${cardKey}-vot-desk`} /></div>
                  <div style={{ gridArea: 'm3' }}><AverageInclusionRateCard key={`${cardKey}-air-desk`} /></div>
                  <div style={{ gridArea: 'm4' }}><AveragePositionCard key={`${cardKey}-ap-desk`} /></div>
                  <div style={{ gridArea: 's1' }}><SentimentScoreCard key={`${cardKey}-ss-desk`} /></div>
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