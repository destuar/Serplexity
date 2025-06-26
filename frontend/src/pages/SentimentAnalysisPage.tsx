import { useState } from 'react';
import { Sparkles, Calendar, RefreshCw, Loader } from 'lucide-react';
import { useCompany } from '../contexts/CompanyContext';
import { useDashboard } from '../hooks/useDashboard';
import { triggerReportGeneration } from '../services/reportService';
import FilterDropdown from '../components/dashboard/FilterDropdown';
import SentimentScoreCard from '../components/dashboard/SentimentScoreCard';
import SentimentOverTimeCard from '../components/dashboard/SentimentOverTimeCard';
import SentimentDetailsCard from '../components/dashboard/SentimentDetailsCard';
import WelcomePrompt from '../components/ui/WelcomePrompt';
import { DashboardFilters, getModelFilterOptions } from '../types/dashboard';

const SentimentAnalysisPage = () => {
  const { selectedCompany } = useCompany();
  const { data, filters, updateFilters, refreshing, refreshData, loading, lastUpdated } = useDashboard();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);

  // Check if we have data to show
  const hasExistingData = data && Object.keys(data).length > 0;

  const handleGenerateReport = async () => {
    if (!selectedCompany) return;

    setIsGenerating(true);
    setGenerationStatus('Analyzing competitor landscape...');
    try {
      // Step 1: Generate competitors
      const exampleCompetitor = selectedCompany.competitors[0]?.name;
      if (!exampleCompetitor) {
        setGenerationStatus('Error: Add one competitor to seed the list.');
        setIsGenerating(false);
        return;
      }

      // Step 2: Trigger report generation
      setGenerationStatus('Initializing report generation pipeline...');
      await triggerReportGeneration(selectedCompany.id);
    } catch (error) {
        console.error("Failed to start report generation:", error);
        setIsGenerating(false);
        setGenerationStatus('Failed to start report generation.');
    }
  };

  const dateRangeOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' },
  ];

  const aiModelOptions = getModelFilterOptions();

  const handleRefresh = async () => {
    await refreshData();
  };

  return (
    <div className="h-full flex flex-col">
      {!hasExistingData ? (
        <WelcomePrompt
          onGenerateReport={handleGenerateReport}
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
          
          <div className="flex-1 min-h-0 p-1">
            {/* Dashboard Grid - Responsive Layout */}
            <div className="h-full w-full">
              {/* Mobile: Stack all cards vertically */}
              <div className="lg:hidden h-full overflow-y-auto space-y-4">
                <div className="min-h-[300px]">
                  <SentimentScoreCard key={`sentiment-analysis-mobile-${filters.aiModel}`} selectedModel={filters.aiModel} />
                </div>
                <div className="min-h-[300px]">
                  <SentimentOverTimeCard selectedModel={filters.aiModel} />
                </div>
                <div className="min-h-[400px]">
                  <SentimentDetailsCard selectedModel={filters.aiModel} />
                </div>
              </div>

              {/* Desktop: Grid Template Areas Layout - 48 columns × 24 rows for maximum control */}
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
                {/* Sentiment Score Card - left half, top */}
                <div style={{ gridArea: 's1' }}>
                  <SentimentScoreCard key={`sentiment-analysis-${filters.aiModel}`} selectedModel={filters.aiModel} />
                </div>
                
                {/* Sentiment Over Time Card - right half, top */}
                <div style={{ gridArea: 's2' }}>
                  <SentimentOverTimeCard selectedModel={filters.aiModel} />
                </div>
                
                {/* Sentiment Details Card - full width, bottom */}
                <div style={{ gridArea: 'd1' }}>
                  <SentimentDetailsCard selectedModel={filters.aiModel} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SentimentAnalysisPage; 