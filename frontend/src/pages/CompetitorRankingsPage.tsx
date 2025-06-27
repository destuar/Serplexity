import { useState, useEffect, useMemo } from 'react';
import { Sparkles, RefreshCw, Loader, Users, TrendingUp, Medal, ArrowUpDown, ChevronUp, ChevronDown, ExternalLink } from 'lucide-react';
import { useCompany } from '../contexts/CompanyContext';
import { useDashboard } from '../hooks/useDashboard';
import { triggerReportGeneration, getReportStatus, getCompetitorRankingsForReport, CompetitorRankingsResponse, CompetitorRanking } from '../services/reportService';
import { generateCompetitors } from '../services/companyService';
import FilterDropdown from '../components/dashboard/FilterDropdown';
import WelcomePrompt from '../components/ui/WelcomePrompt';
import BlankLoadingState from '../components/ui/BlankLoadingState';
import Card from '../components/ui/Card';
import { getModelFilterOptions, DashboardFilters } from '../types/dashboard';
import { getCompanyLogo } from '../lib/logoService';
import { cn } from '../lib/utils';
import { useReportGeneration } from '../hooks/useReportGeneration';

type SortOption = 'shareOfVoice' | 'change' | 'name' | 'ranking';
type SortDirection = 'asc' | 'desc';

const CompetitorRankingsPage = () => {
  const { selectedCompany } = useCompany();
  const { data: dashboardData, filters, loading: dashboardLoading, refreshing, updateFilters, refreshData, lastUpdated, hasReport, refreshTrigger } = useDashboard();
  
  // New local state for this page's specific, detailed data
  const [rankingsData, setRankingsData] = useState<CompetitorRankingsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Report generation logic handled by custom hook
  const { isGenerating, generationStatus, generateReport } = useReportGeneration(selectedCompany);

  // Local state for competitor rankings specific features
  const [sortBy, setSortBy] = useState<SortOption>('shareOfVoice');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [displayLimit, setDisplayLimit] = useState<number>(20);

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
    { value: 'change', label: 'Change (%)' },
    { value: 'name', label: 'Company Name' },
  ];

  // Fetch detailed data for this page
  useEffect(() => {
    const fetchRankings = async () => {
      if (!dashboardData?.runId || !selectedCompany?.id) {
        return;
      }
      
      setIsLoading(true);
      setError(null);
      try {
        const detailedData = await getCompetitorRankingsForReport(dashboardData.runId, selectedCompany.id, filters.aiModel);
        setRankingsData(detailedData);
      } catch (err) {
        console.error("Failed to fetch detailed competitor rankings:", err);
        setError("Could not load detailed rankings.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRankings();
  }, [dashboardData?.runId, selectedCompany?.id, filters.aiModel, refreshTrigger]); // Re-fetch when runId or filter changes

  const handleRefresh = () => {
    refreshData();
  };

  const handleSort = (newSortBy: SortOption) => {
    if (sortBy === newSortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortDirection(newSortBy === 'name' ? 'asc' : 'desc');
    }
  };

  // Process and filter competitor data from the new local state
  const processedCompetitors = useMemo(() => {
    if (!rankingsData?.chartCompetitors) {
      return [];
    }

    let competitors = [...rankingsData.chartCompetitors];

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
          aValue = rankingsData.chartCompetitors?.findIndex(c => c.name === a.name) ?? -1;
          bValue = rankingsData.chartCompetitors?.findIndex(c => c.name === b.name) ?? -1;
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
  }, [rankingsData?.chartCompetitors, sortBy, sortDirection, displayLimit]);

  const getChangeDisplay = (change: number, changeType: string) => {
    // Show gray dash for 0% change (centered to match "0.0%" width)
    if (Math.abs(change) < 0.1) {
      return (
        <div className="flex items-center justify-center text-xs text-gray-400 w-12">
          <span>—</span>
        </div>
      );
    }
    
    const isPositive = changeType === 'increase';
    return (
      <div className={cn(
        "flex items-center text-xs",
        isPositive ? "text-green-600" : "text-red-600"
      )}>
        {isPositive ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        <span className="ml-1">{Math.abs(change).toFixed(1)}%</span>
      </div>
    );
  };

  const renderCompetitorCard = (competitor: CompetitorRanking, index: number) => {
    const logoResult = competitor.website ? getCompanyLogo(competitor.website) : null;
    const ranking = (rankingsData?.chartCompetitors?.findIndex(c => c.name === competitor.name) ?? -1) + 1 || index + 1;
    
    return (
      <div
        key={competitor.name}
        className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-200"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-4 min-w-0 flex-1 mr-4">
            {/* Ranking */}
            <div className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full text-lg font-bold flex-shrink-0",
              competitor.isUserCompany ? "bg-[#7762ff] text-white" : "bg-gray-100 text-gray-600"
            )}>
              {ranking}
            </div>

            {/* Company Logo and Name */}
            <div className="flex items-center space-x-3 min-w-0 flex-1">
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
              
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold truncate text-gray-900">
                  {competitor.name}
                </h3>
                {competitor.website && (
                  <a
                    href={competitor.website.startsWith('http') ? competitor.website : `https://${competitor.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center mt-1 truncate"
                  >
                    <span className="truncate">{competitor.website.replace(/^https?:\/\//, '')}</span>
                    <ExternalLink size={12} className="ml-1 flex-shrink-0" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Share of Voice */}
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-bold text-gray-900">
              {competitor.shareOfVoice.toFixed(1)}%
            </div>
            <div className="mt-1">
              {getChangeDisplay(competitor.change, competitor.changeType)}
            </div>
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

  return (
    <div className="h-full flex flex-col">
      {dashboardLoading || hasReport === null ? (
        <BlankLoadingState message="Loading dashboard data..." />
      ) : hasReport === false ? (
        <WelcomePrompt
          onGenerateReport={generateReport}
          isGenerating={isGenerating}
          generationStatus={generationStatus}
        />
      ) : (
        <>
          {/* Header Section - Always show when there's a report */}
          <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Competitor Rankings</h1>
              {lastUpdated && (
                <p className="text-sm text-gray-500 mt-1">
                  Last updated: {new Date(lastUpdated).toLocaleString()}
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex items-center gap-2 w-full lg:w-auto">
              <FilterDropdown
                label="Show"
                value={displayLimit === 0 ? 'all' : displayLimit.toString()}
                options={displayLimitOptions}
                onChange={(value) => setDisplayLimit(value === 'all' ? 0 : parseInt(value))}
                icon={TrendingUp}
                disabled={dashboardLoading || refreshing || isLoading}
              />
              <FilterDropdown
                label="Sort by"
                value={sortBy}
                options={sortOptions}
                onChange={(value) => handleSort(value as SortOption)}
                icon={ArrowUpDown}
                disabled={dashboardLoading || refreshing || isLoading}
              />
              <FilterDropdown
                label="AI Model"
                value={filters.aiModel}
                options={aiModelOptions}
                onChange={(value) => updateFilters({ aiModel: value as DashboardFilters['aiModel'] })}
                icon={filters.aiModel === 'all' ? Sparkles : undefined}
                disabled={dashboardLoading || refreshing || isLoading}
              />
              <button 
                onClick={handleRefresh}
                disabled={dashboardLoading || refreshing || isLoading}
                className="flex items-center justify-center w-full md:w-auto gap-2 px-4 py-2 bg-[#7762ff] text-white rounded-lg hover:bg-[#6650e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium col-span-2 sm:col-span-1"
              >
                {refreshing || isLoading ? (
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

          {/* Content Area - Show loading state only here */}
          {isLoading || (!rankingsData && !error) ? (
            <BlankLoadingState message="Processing competitor data..." />
          ) : error ? (
            <div className="flex-1 min-h-0 p-1 flex items-center justify-center">
              <p className="text-red-500">{error}</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 p-1">
              <div className="h-full w-full">
                <div className="h-full overflow-y-auto space-y-6">
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
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 pb-6">
                      {processedCompetitors.map((competitor, index) => 
                        renderCompetitorCard(competitor, index)
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CompetitorRankingsPage; 