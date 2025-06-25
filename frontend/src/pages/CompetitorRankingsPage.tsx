import { useState, useEffect, useMemo } from 'react';
import { Sparkles, RefreshCw, Loader, Users, TrendingUp, Medal, ArrowUpDown, ChevronUp, ChevronDown, ExternalLink } from 'lucide-react';
import { useCompany } from '../contexts/CompanyContext';
import { useDashboard } from '../hooks/useDashboard';
import { triggerReportGeneration, getReportStatus } from '../services/reportService';
import { generateCompetitors } from '../services/companyService';
import FilterDropdown from '../components/dashboard/FilterDropdown';
import WelcomePrompt from '../components/ui/WelcomePrompt';
import Card from '../components/ui/Card';
import { getModelFilterOptions, DashboardFilters } from '../types/dashboard';
import { getCompanyLogo } from '../lib/logoService';
import { CompetitorRanking } from '../services/companyService';
import { cn } from '../lib/utils';

type SortOption = 'shareOfVoice' | 'change' | 'name' | 'ranking';
type SortDirection = 'asc' | 'desc';

const CompetitorRankingsPage = () => {
  const { selectedCompany } = useCompany();
  const { data, filters, loading, refreshing, updateFilters, refreshData, lastUpdated } = useDashboard();
  
  // Local state for competitor rankings specific features
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('shareOfVoice');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [displayLimit, setDisplayLimit] = useState<number>(20);

  // Check if we have data to show
  const hasExistingData = data && Object.keys(data).length > 0 && data.competitorRankings;

  // Filter and sort options
  const aiModelOptions = getModelFilterOptions();

  const displayLimitOptions = [
    { value: '10', label: 'Top 10' },
    { value: '20', label: 'Top 20' },
    { value: '50', label: 'Top 50' },
    { value: 'all', label: 'All Competitors' },
  ];

  const sortOptions = [
    { value: 'shareOfVoice', label: 'Share of Voice' },
    { value: 'change', label: 'Change' },
    { value: 'name', label: 'Name' },
    { value: 'ranking', label: 'Ranking' },
  ];

  // Handle report generation polling
  useEffect(() => {
    if (!isGenerating || !runId) {
      return;
    }

    const poll = setInterval(async () => {
      try {
        const statusRes = await getReportStatus(runId);
        
        setGenerationStatus(statusRes.stepStatus || 'Processing data...');
        
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
      const exampleCompetitor = selectedCompany.competitors[0]?.name;
      if (!exampleCompetitor) {
        setGenerationStatus('Error: Add one competitor to seed the list.');
        setIsGenerating(false);
        return;
      }

      await generateCompetitors(selectedCompany.id, exampleCompetitor);

      setGenerationStatus('Initializing report generation pipeline...');
      const { runId: newRunId } = await triggerReportGeneration(selectedCompany.id);
      setRunId(newRunId);
    } catch (error) {
        console.error("Failed to start report generation:", error);
        setIsGenerating(false);
        setGenerationStatus('Failed to start report generation.');
    }
  };

  const handleRefresh = async () => {
    await refreshData();
  };

  const handleSort = (newSortBy: SortOption) => {
    if (sortBy === newSortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortDirection(newSortBy === 'name' ? 'asc' : 'desc');
    }
  };

  // Process and filter competitor data
  const processedCompetitors = useMemo(() => {
    if (!data?.competitorRankings?.chartCompetitors) {
      return [];
    }

    let competitors = [...data.competitorRankings.chartCompetitors];

    // Sort competitors
    competitors.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortBy) {
        case 'shareOfVoice':
          aValue = a.shareOfVoice;
          bValue = b.shareOfVoice;
          break;
        case 'change':
          aValue = a.change;
          bValue = b.change;
          break;
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'ranking':
          // Find the index in the original array (natural ranking)
          aValue = data.competitorRankings?.chartCompetitors?.findIndex(c => c.name === a.name) ?? -1;
          bValue = data.competitorRankings?.chartCompetitors?.findIndex(c => c.name === b.name) ?? -1;
          break;
        default:
          aValue = a.shareOfVoice;
          bValue = b.shareOfVoice;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      const numA = Number(aValue);
      const numB = Number(bValue);
      return sortDirection === 'asc' ? numA - numB : numB - numA;
    });

    // Apply display limit
    if (displayLimit !== 0) {
      competitors = competitors.slice(0, displayLimit);
    }

    return competitors;
  }, [data?.competitorRankings?.chartCompetitors, sortBy, sortDirection, displayLimit]);

  const getOrdinalSuffix = (num: number): string => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  };

  const getChangeDisplay = (change: number, changeType: string) => {
    if (change === 0) return null;
    
    const isPositive = changeType === 'increase';
    return (
      <div className={cn(
        "flex items-center text-xs px-2 py-1 rounded-full",
        isPositive ? "text-green-700 bg-green-100" : "text-red-700 bg-red-100"
      )}>
        {isPositive ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        <span className="ml-1">{Math.abs(change).toFixed(1)}%</span>
      </div>
    );
  };

  const renderCompetitorCard = (competitor: CompetitorRanking, index: number) => {
    const logoResult = competitor.website ? getCompanyLogo(competitor.website) : null;
    const ranking = (data?.competitorRankings?.chartCompetitors?.findIndex(c => c.name === competitor.name) ?? -1) + 1 || index + 1;
    
    return (
      <div
        key={competitor.name}
        className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-200"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-4">
            {/* Ranking */}
            <div className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full text-lg font-bold",
              ranking <= 3 ? "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white" :
              competitor.isUserCompany ? "bg-[#7762ff] text-white" : "bg-gray-100 text-gray-600"
            )}>
              {ranking <= 3 && <Medal size={16} className="mr-1" />}
              {ranking}
            </div>

            {/* Company Logo and Name */}
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                {logoResult ? (
                  <img
                    src={logoResult.url}
                    alt={`${competitor.name} logo`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.setAttribute('style', 'display: flex');
                    }}
                  />
                ) : null}
                <div 
                  className="w-full h-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600"
                  style={{ display: logoResult ? 'none' : 'flex' }}
                >
                  {competitor.name.charAt(0).toUpperCase()}
                </div>
              </div>
              
              <div>
                <h3 className={cn(
                  "text-lg font-semibold",
                  competitor.isUserCompany ? "text-[#7762ff]" : "text-gray-900"
                )}>
                  {competitor.name}
                  {competitor.isUserCompany && (
                    <span className="ml-2 text-xs bg-[#7762ff] text-white px-2 py-1 rounded-full">
                      You
                    </span>
                  )}
                </h3>
                {competitor.website && (
                  <a
                    href={competitor.website.startsWith('http') ? competitor.website : `https://${competitor.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center mt-1"
                  >
                    {competitor.website.replace(/^https?:\/\//, '')}
                    <ExternalLink size={12} className="ml-1" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Share of Voice */}
          <div className="text-right">
            <div className={cn(
              "text-2xl font-bold",
              competitor.isUserCompany ? "text-[#7762ff]" : "text-gray-900"
            )}>
              {competitor.shareOfVoice.toFixed(1)}%
            </div>
            {getChangeDisplay(competitor.change, competitor.changeType)}
          </div>
        </div>

        {/* Share of Voice Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Share of Voice</span>
            <span className="text-gray-500">vs {(100 - competitor.shareOfVoice).toFixed(1)}% others</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={cn(
                "h-2 rounded-full transition-all duration-500",
                competitor.isUserCompany ? "bg-[#7762ff]" : "bg-gray-400"
              )}
              style={{ width: `${Math.max(competitor.shareOfVoice, 2)}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  if (!hasExistingData) {
    return (
      <div className="h-full flex flex-col">
        <WelcomePrompt
          onGenerateReport={handleGenerateReport}
          isGenerating={isGenerating}
          generationStatus={generationStatus}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header Section - Consistent with other pages */}
      <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Competitor Rankings</h1>
          {lastUpdated && (
            <p className="text-sm text-gray-500 mt-1">
              Last updated: {new Date(lastUpdated).toLocaleString()}
            </p>
          )}
        </div>
        
        <div className="flex flex-wrap items-center justify-end gap-2">
          <FilterDropdown
            label="Show"
            value={displayLimit === 0 ? 'all' : displayLimit.toString()}
            options={displayLimitOptions}
            onChange={(value) => setDisplayLimit(value === 'all' ? 0 : parseInt(value))}
            icon={TrendingUp}
            disabled={loading || refreshing}
          />
          <FilterDropdown
            label="Sort by"
            value={sortBy}
            options={sortOptions}
            onChange={(value) => handleSort(value as SortOption)}
            icon={ArrowUpDown}
            disabled={loading || refreshing}
          />
          <FilterDropdown
            label="AI Model"
            value={filters.aiModel}
            options={aiModelOptions}
            onChange={(value) => updateFilters({ aiModel: value as DashboardFilters['aiModel'] })}
            icon={filters.aiModel === 'all' ? Sparkles : undefined}
            disabled={loading || refreshing}
          />
          <button 
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="flex items-center justify-center w-full md:w-auto gap-2 px-4 py-2 bg-[#7762ff] text-white rounded-lg hover:bg-[#6650e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
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
        <div className="h-full w-full">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center space-y-4">
                <Loader className="w-8 h-8 animate-spin text-[#7762ff]" />
                <p className="text-gray-600">Loading competitor data...</p>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto space-y-6">
              {/* Stats Cards Row */}
              <div className="flex flex-wrap gap-4">
                <Card className="p-4 min-w-[140px] flex-1">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {data?.competitorRankings?.industryRanking || 'N/A'}
                      {data?.competitorRankings?.industryRanking && (
                        <span className="text-sm font-normal text-gray-500">
                          {getOrdinalSuffix(data?.competitorRankings?.industryRanking)}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">Your Ranking</div>
                  </div>
                </Card>
                
                <Card className="p-4 min-w-[140px] flex-1">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {data?.competitorRankings?.userCompany?.shareOfVoice?.toFixed(1) || '0.0'}%
                    </div>
                    <div className="text-sm text-gray-600">Your Share</div>
                  </div>
                </Card>

                <Card className="p-4 min-w-[140px] flex-1">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {data?.competitorRankings?.chartCompetitors?.length || 0}
                    </div>
                    <div className="text-sm text-gray-600">Total Competitors</div>
                  </div>
                </Card>
              </div>

              {/* Competitors Grid */}
              {processedCompetitors.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <Users size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 text-lg">
                      No competitor data available
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 pb-6">
                  {processedCompetitors.map((competitor, index) => 
                    renderCompetitorCard(competitor, index)
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompetitorRankingsPage; 