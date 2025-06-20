import { Calendar, Sparkles, RefreshCw, Loader } from "lucide-react";
import { useState, useEffect } from "react";
import { useCompany } from "../contexts/CompanyContext";
import { useDashboard } from "../contexts/DashboardContext";
import { triggerReportGeneration, getReportStatus } from '../services/reportService';
import FilterDropdown from "../components/dashboard/FilterDropdown";
import BrandShareOfVoiceCard from "../components/dashboard/BrandShareOfVoiceCard";
import BrandVisibilityCard from "../components/dashboard/BrandVisibilityCard";
import ConceptSourceCard from "../components/dashboard/ConceptSourceCard";
import KeywordTrendCard from "../components/dashboard/KeywordTrendCard";
import SentimentCard from "../components/dashboard/SentimentCard";
import SourceChangesCard from "../components/dashboard/SourceChangesCard";

const OverviewPage = () => {
  const { selectedCompany } = useCompany();
  const { data, filters, loading, refreshing, updateFilters, refreshData, lastUpdated } = useDashboard();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!isGenerating || !runId) {
      return;
    }

    const poll = setInterval(async () => {
      try {
        const statusRes = await getReportStatus(runId);
        setGenerationStatus(`Step: ${statusRes.stepStatus || 'N/A'}`);
        if (statusRes.status === 'COMPLETED' || statusRes.status === 'FAILED') {
          setIsGenerating(false);
          setRunId(null);
          setGenerationStatus(statusRes.status === 'COMPLETED' ? 'Report ready!' : 'Generation failed.');
          if (statusRes.status === 'COMPLETED') {
            await refreshData();
          }
        }
      } catch (pollError) {
        console.error("Status polling failed:", pollError);
        setIsGenerating(false);
        setRunId(null);
        setGenerationStatus('Error fetching status.');
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(poll); // Cleanup on unmount or when dependencies change
  }, [isGenerating, runId, refreshData]);

  // Filter options
  const dateRangeOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' },
  ];

  const aiModelOptions = [
    { value: 'all', label: 'All Models' },
    { value: 'gemini-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'claude-3', label: 'Claude 3' },
  ];

  const handleRefresh = async () => {
    await refreshData();
  };

  const handleGenerateReport = async () => {
    if (!selectedCompany) return;

    setIsGenerating(true);
    setGenerationStatus('Queued...');
    try {
      const { runId: newRunId } = await triggerReportGeneration(selectedCompany.id);
      setRunId(newRunId);
    } catch (error) {
        console.error("Failed to start report generation:", error);
        setIsGenerating(false);
        setGenerationStatus('Failed to start generation.');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header Section - Fixed Height */}
      <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-4">
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
            onChange={(value) => updateFilters({ dateRange: value as any })}
            icon={Calendar}
            disabled={loading}
          />
          
          <FilterDropdown
            label="AI Model"
            value={filters.aiModel}
            options={aiModelOptions}
            onChange={(value) => updateFilters({ aiModel: value as any })}
            icon={Sparkles}
            disabled={loading}
          />
          
          <button 
            onClick={handleRefresh}
            disabled={loading || refreshing || isGenerating}
            className="flex items-center justify-center w-full lg:w-auto gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium col-span-2"
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

          <button 
            onClick={handleGenerateReport}
            disabled={loading || refreshing || isGenerating}
            className="flex items-center justify-center w-full lg:w-auto gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium col-span-2"
          >
            {isGenerating ? (
              <>
                <Loader size={16} className="animate-spin" />
                <span className="whitespace-nowrap">{generationStatus || 'Generating...'}</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span className="whitespace-nowrap">Generate Report</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Dashboard Grid - Dynamic Height with Custom Rows */}
      {loading && !data ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <Loader className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-gray-600">Loading dashboard data...</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 grid-rows-[min-content_1fr] gap-4 min-h-0">
          <BrandShareOfVoiceCard />
          <BrandVisibilityCard />
          <KeywordTrendCard />
          <SentimentCard />
          <div className="col-span-1 md:col-span-2 flex">
            <SourceChangesCard />
          </div>
          <div className="col-span-1 md:col-span-2 flex">
            <ConceptSourceCard />
          </div>
        </div>
      )}
    </div>
  );
};

export default OverviewPage; 