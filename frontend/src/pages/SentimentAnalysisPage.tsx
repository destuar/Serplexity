import { useState, useEffect } from 'react';
import { Sparkles, Calendar, RefreshCw, Loader } from 'lucide-react';
import { useCompany } from '../contexts/CompanyContext';
import { useDashboard } from '../hooks/useDashboard';
import { triggerReportGeneration, getReportStatus } from '../services/reportService';
import FilterDropdown from '../components/dashboard/FilterDropdown';
import SentimentScoreCard from '../components/dashboard/SentimentScoreCard';
import SentimentOverTimeCard from '../components/dashboard/SentimentOverTimeCard';
import SentimentDetailsCard from '../components/dashboard/SentimentDetailsCard';
import WelcomePrompt from '../components/ui/WelcomePrompt';
import { DashboardFilters, getModelFilterOptions } from '../types/dashboard';

const SentimentAnalysisPage = () => {
  const { selectedCompany } = useCompany();
  const { data, filters, updateFilters, refreshing, refreshData, loading } = useDashboard();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  // Check if we have data to show
  const hasExistingData = data && Object.keys(data).length > 0;

  // Handle report generation polling
  useEffect(() => {
    if (!isGenerating || !runId) {
      return;
    }

    const poll = setInterval(async () => {
      try {
        const statusRes = await getReportStatus(runId);
        
        // Map technical status to user-friendly messages
        const getUserFriendlyStatus = (stepStatus: string) => {
          if (!stepStatus || stepStatus === 'N/A') return 'Processing data...';
          
          const statusMap: { [key: string]: string } = {
            'QUEUED': 'Queued for processing...',
            'RUNNING': 'Analyzing market data...',
            'SCRAPING': 'Gathering competitive intelligence...',
            'ANALYZING': 'Processing search results...',
            'SENTIMENT_ANALYSIS': 'Analyzing sentiment and positioning...',
            'RANKING_ANALYSIS': 'Calculating ranking positions...',
            'GENERATING_INSIGHTS': 'Generating strategic insights...',
            'FINALIZING': 'Finalizing report data...',
            'COMPLETED': 'Report generation complete'
          };
          
          return statusMap[stepStatus.toUpperCase()] || `Processing: ${stepStatus}...`;
        };

        setGenerationStatus(getUserFriendlyStatus(statusRes.stepStatus));
        
        if (statusRes.status === 'COMPLETED' || statusRes.status === 'FAILED') {
          setIsGenerating(false);
          setRunId(null);
          setGenerationStatus(statusRes.status === 'COMPLETED' ? 'Report generated successfully' : 'Report generation failed');
          if (statusRes.status === 'COMPLETED') {
            await refreshData();
          }
        }
      } catch (pollError) {
        console.error("Status polling failed:", pollError);
        setIsGenerating(false);
        setRunId(null);
        setGenerationStatus('Connection error during generation');
      }
    }, 2000);

    return () => clearInterval(poll);
  }, [isGenerating, runId, refreshData]);

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
      const { runId: newRunId } = await triggerReportGeneration(selectedCompany.id);
      setRunId(newRunId);
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
          <div className="flex-shrink-0 mb-6 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Sentiment Analysis</h1>
            <div className="flex items-center gap-2 ml-auto">
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
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[#7762ff] text-white rounded-lg hover:bg-[#6650e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
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