import { Sparkles, Calendar, RefreshCw, Loader } from 'lucide-react';
import { useCompany } from '../contexts/CompanyContext';
import { useDashboard } from '../hooks/useDashboard';
import { useReportGeneration } from '../hooks/useReportGeneration';
import FilterDropdown from '../components/dashboard/FilterDropdown';
import SentimentScoreDisplayCard from '../components/dashboard/SentimentScoreDisplayCard';
import SentimentOverTimeCard from '../components/dashboard/SentimentOverTimeCard';
import SentimentDetailsCard from '../components/dashboard/SentimentDetailsCard';
import WelcomePrompt from '../components/ui/WelcomePrompt';
import BlankLoadingState from '../components/ui/BlankLoadingState';
import { DashboardFilters, getModelFilterOptions } from '../types/dashboard';

const SentimentAnalysisPage = () => {
  const { selectedCompany } = useCompany();
  const { data, filters, updateFilters, refreshing, refreshData, loading, lastUpdated, hasReport, refreshTrigger } = useDashboard();
  const { isGenerating, generationStatus, generateReport } = useReportGeneration(selectedCompany);

  const dateRangeOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' },
  ];

  const aiModelOptions = getModelFilterOptions();

  const handleRefresh = () => {
    refreshData();
  };

  const cardKey = `sentiment-${filters.aiModel}-${filters.dateRange}-${refreshTrigger}`;

  return (
    <div className="h-full flex flex-col">
      {loading || hasReport === null ? (
        <BlankLoadingState message="Loading sentiment analysis data..." />
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
              <h1 className="text-2xl font-bold text-gray-900">Sentiment Analysis</h1>
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
                onChange={(value) => updateFilters({ dateRange: value as DashboardFilters['dateRange'] })}
                icon={Calendar}
                disabled={loading || refreshing || isGenerating}
              />
              <FilterDropdown
                label="AI Model"
                value={filters.aiModel}
                options={aiModelOptions}
                onChange={(value) => updateFilters({ aiModel: value as DashboardFilters['aiModel'] })}
                icon={filters.aiModel === 'all' ? Sparkles : undefined}
                disabled={loading || refreshing || isGenerating}
              />
              <button 
                onClick={handleRefresh}
                disabled={loading || refreshing || isGenerating}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[#7762ff] text-white rounded-lg hover:bg-[#6650e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium col-span-2"
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
            <BlankLoadingState message="Processing sentiment data..." />
          ) : (
            <div className="flex-1 min-h-0 p-1">
              <div className="h-full w-full">
                <div className="lg:hidden h-full overflow-y-auto space-y-4">
                  <div className="min-h-[300px]">
                    <SentimentScoreDisplayCard key={`${cardKey}-score-mobile`} selectedModel={filters.aiModel} />
                  </div>
                  <div className="min-h-[300px]">
                    <SentimentOverTimeCard key={`${cardKey}-sot-mobile`} selectedModel={filters.aiModel} />
                  </div>
                  <div className="min-h-[400px]">
                    <SentimentDetailsCard key={`${cardKey}-sd-mobile`} selectedModel={filters.aiModel} />
                  </div>
                </div>

                <div className="hidden lg:grid h-full w-full gap-4" style={{
                  gridTemplateColumns: 'repeat(48, 1fr)',
                  gridTemplateRows: 'repeat(24, minmax(30px, 1fr))',
                  gridTemplateAreas: `
                    "s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2"
                    "s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2"
                    "s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2"
                    "s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2"
                    "s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2"
                    "s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2"
                    "s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2"
                    "s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2"
                    "d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1"
                    "d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1"
                    "d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1"
                    "d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1"
                    "d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1"
                    "d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1"
                  `
                }}>
                  <div style={{ gridArea: 's1' }}><SentimentScoreDisplayCard key={`${cardKey}-score-desk`} selectedModel={filters.aiModel} /></div>
                  <div style={{ gridArea: 's2' }}><SentimentOverTimeCard key={`${cardKey}-sot-desk`} selectedModel={filters.aiModel} /></div>
                  <div style={{ gridArea: 'd1' }}><SentimentDetailsCard key={`${cardKey}-sd-desk`} selectedModel={filters.aiModel} /></div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SentimentAnalysisPage; 