/**
 * @file RankingsCard.tsx
 * @description This component displays competitor rankings and share of voice data. It presents the user's company's
 * industry ranking and a list of top competitors, including their share of voice and changes from the previous period.
 * It uses a bar chart for visual representation and integrates with `useDashboard` for data. This is a key component
 * for competitive analysis.
 *
 * @dependencies
 * - lucide-react: Icon library for React.
 * - react-router-dom: For navigation (`useNavigate`).
 * - ../ui/Card: Generic card component for consistent UI.
 * - ../../hooks/useDashboard: Custom hook for accessing dashboard data.
 * - ../../lib/logoService: Utility for fetching company logos.
 * - ../../hooks/useMediaQuery: Custom hook for media queries.
 *
 * @exports
 * - RankingsCard: React functional component for displaying competitor rankings.
 */
import { ChevronUp, ChevronDown, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { chartColorArrays } from '../../utils/colorClasses';
import LiquidGlassCard from '../ui/LiquidGlassCard';
import { useDashboard } from '../../hooks/useDashboard';
import { getCompanyLogo } from '../../lib/logoService';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useCompany } from '../../contexts/CompanyContext';
import { CompetitorData } from '../../services/companyService';

type TabType = 'mentions' | 'citations';

// Enhanced competitor type that merges report metrics with live data
interface EnhancedCompetitor {
  name: string;
  website?: string;
  shareOfVoice: number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'stable';
  isUserCompany: boolean;
  // Additional metadata for debugging and validation
  dataSource: 'report' | 'hybrid' | 'live';
  lastUpdated?: string;
}

const RankingsCard = () => {
  const { data, loading: dashboardLoading, error, acceptedCompetitors } = useDashboard();
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const isTallerScreen = useMediaQuery('(min-height: 900px)');
  const [activeTab, setActiveTab] = useState<TabType>('mentions');

  // Create enhanced competitors using the live data already available from DashboardContext
  const liveCompetitors = useMemo((): CompetitorData[] => {
    if (!selectedCompany?.id) {
      return [];
    }

    // Add user's company to the live data for completeness
    const userCompanyAsCompetitor: CompetitorData = {
      id: selectedCompany.id,
      name: selectedCompany.name,
      website: selectedCompany.website || undefined,
      isGenerated: false,
      isAccepted: true,
    };
    
    const allCompetitors = [userCompanyAsCompetitor, ...acceptedCompetitors];
    
    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[RankingsCard] Using live competitor data from context:', allCompetitors.length, 'competitors');
    }
    
    return allCompetitors;
  }, [selectedCompany?.id, selectedCompany?.name, selectedCompany?.website, acceptedCompetitors]);

  // Data is now pre-calculated on the backend
  const rankingsData = data?.competitorRankings;
  const citationData = data?.citationRankings;

  // Enhanced competitor merger: combines report metrics with live data
  const enhancedCompetitors = useMemo((): EnhancedCompetitor[] => {
    if (!rankingsData?.chartCompetitors) {
      return [];
    }

    // Create a lookup map for live competitor data by normalized name
    const liveCompetitorMap = new Map<string, CompetitorData>();
    liveCompetitors.forEach(competitor => {
      const normalizedName = competitor.name.toLowerCase().trim();
      liveCompetitorMap.set(normalizedName, competitor);
    });

    // Merge report data with live data, prioritizing live data for name/website
    const enhanced = rankingsData.chartCompetitors.map((reportCompetitor): EnhancedCompetitor => {
      const normalizedReportName = reportCompetitor.name.toLowerCase().trim();
      const liveData = liveCompetitorMap.get(normalizedReportName);

      if (liveData) {
        // Hybrid: Use live data for identity, report data for metrics
        const hybridCompetitor = {
          ...reportCompetitor,
          name: liveData.name, // Use live name (handles any case/formatting updates)
          website: liveData.website, // Use live website (this is the key fix!)
          dataSource: 'hybrid' as const,
          lastUpdated: new Date().toISOString(),
        };
        
        // Debug logging for website changes in development
        if (process.env.NODE_ENV === 'development' && reportCompetitor.website !== liveData.website) {
          console.log(`[RankingsCard] Website updated for ${liveData.name}: ${reportCompetitor.website} -> ${liveData.website}`);
        }
        
        return hybridCompetitor;
      } else {
        // Report-only: Live data not available, use report data as-is
        return {
          ...reportCompetitor,
          dataSource: 'report' as const,
        } as EnhancedCompetitor;
      }
    });

    // Performance logging in development
    if (process.env.NODE_ENV === 'development') {
      const hybridCount = enhanced.filter(c => c.dataSource === 'hybrid').length;
      const reportOnlyCount = enhanced.filter(c => c.dataSource === 'report').length;
      console.log(`[RankingsCard] Enhanced competitors: ${hybridCount} hybrid, ${reportOnlyCount} report-only`);
    }

    return enhanced;
  }, [rankingsData?.chartCompetitors, liveCompetitors]);

  // Filter enhanced competitors to only show accepted ones
  const filteredRankingsData = useMemo(() => {
    if (!rankingsData || enhancedCompetitors.length === 0) {
      return null;
    }
    
    // If we have no accepted competitors, show empty state
    if (selectedCompany?.id && acceptedCompetitors.length === 0) {
      return {
        ...rankingsData,
        competitors: [],
        chartCompetitors: [],
      };
    }

    // Create a set of accepted competitor names (including user company)
    const acceptedNames = new Set(
      acceptedCompetitors.map(comp => comp.name.toLowerCase().trim())
    );

    // Filter enhanced competitors to only include accepted ones
    const filteredCompetitors = enhancedCompetitors.filter(competitor => 
      competitor.isUserCompany || acceptedNames.has(competitor.name.toLowerCase().trim())
    );

    return {
      ...rankingsData,
      competitors: filteredCompetitors,
      chartCompetitors: filteredCompetitors,
    };
  }, [rankingsData, enhancedCompetitors, acceptedCompetitors, selectedCompany?.id]);

  // Loading state: use dashboard loading since competitor data is fetched with it
  const isLoading = dashboardLoading;

  // Note: Using EnhancedCompetitor type instead of basic Competitor for fresh data

  // Define the citation type for source domains
  type Citation = {
    domain: string;
    name: string;
    shareOfVoice: number;
    citationCount: number;
    uniqueUrls: number;
    sampleTitle: string;
  };

  const getOrdinalSuffix = (num: number): string => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) {
      return 'st';
    }
    if (j === 2 && k !== 12) {
      return 'nd';
    }
    if (j === 3 && k !== 13) {
      return 'rd';
    }
    return 'th';
  };

  const renderIndustryRanking = () => {
    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Error loading data</p>
        </div>
      );
    }

    // If company has no ranking (not mentioned), show N/A with enhanced data
    if (!rankingsData?.industryRanking) {
      const chartData = filteredRankingsData?.chartCompetitors as EnhancedCompetitor[] || [];
      const displayedChartData = chartData.slice(0, Math.min(12, chartData.length));
      
      return (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-5xl font-bold text-gray-800 mb-6">
            N/A
          </div>
          <div className="flex items-end justify-center space-x-1 h-16 w-full max-w-64">
            {displayedChartData.length > 0 ? (
              displayedChartData.map((competitor: EnhancedCompetitor, index: number) => {
                const maxShareOfVoice = Math.max(...displayedChartData.map((c: EnhancedCompetitor) => c.shareOfVoice));
                const heightPercent = maxShareOfVoice > 0 ? (competitor.shareOfVoice / maxShareOfVoice) * 100 : 0;
                const heightPx = Math.max(8, Math.round((heightPercent / 100) * 64));
                const isUserCompany = competitor.isUserCompany;
                
                return (
                  <div
                    key={`${competitor.name}-${index}`}
                    className={`
                      w-3 rounded-t transition-all duration-300
                      ${isUserCompany ? 'bg-blue-600' : 'bg-gray-300'}
                    `}
                    style={{ height: `${heightPx}px` }}
                    title={`${competitor.name}: ${competitor.shareOfVoice.toFixed(1)}% (${competitor.dataSource})`}
                  />
                );
              })
            ) : (
              // Show 12 small gray bars when no data
              Array.from({ length: 12 }, (_, index) => (
                <div
                  key={`placeholder-${index}`}
                  className="w-3 h-2 rounded-t bg-gray-200"
                />
              ))
            )}
          </div>
        </div>
      );
    }

    // Chart logic using enhanced competitors for fresh data
    const chartData = filteredRankingsData?.chartCompetitors as EnhancedCompetitor[] || [];
    // Show up to 12 competitors, or all available if fewer than 12
    const displayedChartData = chartData.slice(0, Math.min(12, chartData.length));
    const maxShareOfVoice = displayedChartData.length > 0 ? Math.max(...displayedChartData.map((c: EnhancedCompetitor) => c.shareOfVoice)) : 0;
    
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="text-6xl font-bold text-gray-800 mb-6">
        {filteredRankingsData?.industryRanking}
        <span className="text-xl font-normal text-gray-500">{getOrdinalSuffix(filteredRankingsData?.industryRanking || 0)}</span>
      </div>
        <div className="flex items-end justify-center space-x-1 h-16 w-full max-w-64">
          {displayedChartData.map((competitor: EnhancedCompetitor, index: number) => {
            const isUserCompany = competitor.isUserCompany;
            // Calculate height based on share of voice percentage (minimum 8px, maximum 64px)
            const heightPercent = maxShareOfVoice > 0 ? (competitor.shareOfVoice / maxShareOfVoice) * 100 : 0;
            const heightPx = Math.max(8, Math.round((heightPercent / 100) * 64));
            
            return (
              <div
                key={`${competitor.name}-${index}`}
                className="w-3 rounded-t transition-all duration-300"
                style={{ 
                  height: `${heightPx}px`,
                  backgroundColor: isUserCompany ? chartColorArrays.primary[0] : '#d1d5db' // blue-600 : gray-300
                }}
                title={`${competitor.name}: ${competitor.shareOfVoice.toFixed(1)}% (${competitor.dataSource})`}
              />
            );
          })}
        </div>

      </div>
    );
  };

  const renderMentionsView = () => {
    // Enhanced error handling: show loading state or error with context
    if (error && !isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Error loading data</p>
        </div>
      );
    }

    // Show loading state while data is being fetched
    if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Loading competitor rankings...</p>
        </div>
      );
    }

    // Use enhanced competitors (with fresh website data) instead of raw report data
    if (!filteredRankingsData || !filteredRankingsData.chartCompetitors || filteredRankingsData.chartCompetitors.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">No competitor mentions found</p>
        </div>
      );
    }

    const numCompetitorsToShow = isTallerScreen ? 5 : 4;

    // Use enhanced competitors (these have fresh website data from live API)
    const allCompetitors = filteredRankingsData.chartCompetitors as EnhancedCompetitor[];
    const topCompetitors = allCompetitors.slice(0, numCompetitorsToShow);
    const remainingCompetitors = allCompetitors.slice(numCompetitorsToShow);
    const remainingCount = remainingCompetitors.length;
    
    // Calculate combined share of voice for remaining competitors
    const remainingShareOfVoice = remainingCompetitors.reduce((total: number, competitor: EnhancedCompetitor) => total + competitor.shareOfVoice, 0);
    
    // Create the display list with enhanced competitors
    const displayCompetitors: (EnhancedCompetitor | { name: string; shareOfVoice: number; change: number; changeType: 'stable'; isUserCompany: boolean; website?: string; dataSource?: string })[] = [...topCompetitors];
    if (remainingCount > 0) {
      // Add "X+ others" entry with combined percentage
      displayCompetitors.push({
        name: `${remainingCount}+ others`,
        shareOfVoice: remainingShareOfVoice,
        change: 0,
        changeType: 'stable' as const,
        isUserCompany: false,
        website: undefined,
        dataSource: 'aggregated'
      });
    }

    return (
      <div className="flex-1 space-y-1">
        {displayCompetitors.map((competitor, index: number) => {
          const logoResult = competitor.website ? getCompanyLogo(competitor.website) : null;
          const isOthers = competitor.name.includes('others');
          
          return (
            <div 
              key={`${competitor.name}-${index}`} 
              className={`flex items-center justify-between rounded-lg px-2 py-1 transition-colors hover:bg-gray-50 ${
                isOthers ? 'cursor-pointer' : ''
              }`}
              onClick={isOthers ? () => navigate('/competitors') : undefined}
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <span className="text-sm font-medium w-4 flex-shrink-0 text-gray-600">{index + 1}.</span>
                
                {/* Company Logo - don't show for Others */}
                {!isOthers && (
                  <div className="w-6 h-6 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                    {logoResult ? (
                      <img
                        src={logoResult.url}
                        alt={`${competitor.name} logo`}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          // Fallback to first letter if logo fails to load
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.setAttribute('style', 'display: flex');
                        }}
                      />
                    ) : null}
                    <div 
                      className="w-full h-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600"
                      style={{ display: logoResult ? 'none' : 'flex' }}
                    >
                      {competitor.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
                
                {/* Add spacing for Others entry to align with other entries */}
                {isOthers && <div className="w-6 h-6 flex-shrink-0"></div>}

                {/* Company Name - fixed width container for consistent alignment */}
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium block break-words ${
                    isOthers ? 'text-gray-500 italic hover:underline' : 'text-gray-800'
                  }`} style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    overflowWrap: 'anywhere'
                  }}>
                    {competitor.name}
                  </span>
                </div>
              </div>

              {/* Share of Voice and Change - don't show change for Others */}
              <div className="flex items-center flex-shrink-0">
                {/* Change indicator with fixed width */}
                <div className="w-12 flex justify-start">
                  {!isOthers && (
                    <>
                      {Math.abs(competitor.change ?? 0) < 0.1 ? (
                        <div className="flex items-center justify-center text-xs text-gray-400 w-full">
                          <span>—</span>
                        </div>
                      ) : (
                        <div className={`flex items-center text-xs ${
                          competitor.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {competitor.changeType === 'increase' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          <span className="ml-1">{Math.abs(competitor.change ?? 0).toFixed(1)}%</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {/* Share of voice with fixed width for alignment */}
                <div className="w-10 text-right">
                  <span className={`text-sm font-semibold ${
                    isOthers ? 'text-gray-500' : 'text-gray-700'
                  }`}>
                    {competitor.shareOfVoice.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCitationsView = () => {
    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Error loading data</p>
        </div>
      );
    }

    // Use citation sources from backend
    if (!citationData || !citationData.sources || citationData.sources.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">No citation sources found</p>
        </div>
      );
    }

    const maxSlots = isTallerScreen ? 4 : 3;
    const allSources = citationData.sources;

    // Always show at least 3 sources plus "X+ others" if there are more than maxSlots
    let displaySources: (Citation | { domain: string; name: string; shareOfVoice: number; citationCount: number; uniqueUrls: number; sampleTitle: string })[];
    if (allSources.length > maxSlots) {
      // Show first 3 sources (or maxSlots-1 if maxSlots is 4), then "X+ others"
      const numToShow = Math.max(3, maxSlots - 1);
      const topSources = allSources.slice(0, numToShow);
      const remainingSources = allSources.slice(numToShow);
      const remainingCount = remainingSources.length;
      
      // Calculate combined share of voice for remaining sources
      const remainingShareOfVoice = remainingSources.reduce((total: number, source: Citation) => total + source.shareOfVoice, 0);
      
      displaySources = [
        ...topSources,
        {
          domain: `${remainingCount}+ others`,
          name: `${remainingCount}+ others`,
          shareOfVoice: remainingShareOfVoice,
          citationCount: remainingSources.reduce((total: number, source: Citation) => total + source.citationCount, 0),
          uniqueUrls: 0,
          sampleTitle: 'Additional sources'
        }
      ];
    } else {
      // Show all sources if they fit within the available slots
      displaySources = allSources;
    }

    return (
      <div className="flex-1 space-y-1">
        {displaySources.map((source: Citation, index: number) => {
          const isOthers = source.domain.includes('others');
          
          return (
            <div 
              key={`${source.domain}-${index}`} 
              className="flex items-center justify-between rounded-lg px-2 py-1 transition-colors hover:bg-gray-50"
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <span className="text-sm font-medium w-4 flex-shrink-0 text-gray-600">
                  {index + 1}.
                </span>
                
                {/* Domain Favicon/Icon */}
                {!isOthers && (
                  <div className="w-6 h-6 rounded overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${source.domain}&sz=32`}
                      alt={`${source.domain} favicon`}
                      className="w-4 h-4"
                      onError={(e) => {
                        // Fallback to first letter if favicon fails to load
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.setAttribute('style', 'display: flex');
                      }}
                    />
                    <div 
                      className="w-full h-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600"
                      style={{ display: 'none' }}
                    >
                      {source.domain.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
                
                {/* Add spacing for Others entry to align with other entries */}
                {isOthers && <div className="w-6 h-6 flex-shrink-0"></div>}

                {/* Domain Name - fixed width container for consistent alignment */}
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium block break-words ${
                    isOthers ? 'text-gray-500 italic' : 'text-gray-800'
                  }`} style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    overflowWrap: 'anywhere'
                  }}>
                    {source.domain}
                  </span>
                  {!isOthers && (
                    <div className="text-xs text-gray-500 truncate">
                      {source.citationCount} citation{source.citationCount !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>

              {/* Share of Voice and External Link */}
              <div className="flex items-center flex-shrink-0">
                {/* External link for non-others */}
                <div className="w-12 flex justify-start">
                  {!isOthers && (
                    <a
                      href={`https://${source.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                {/* Share of voice with fixed width for alignment */}
                <div className="w-10 text-right">
                  <span className={`text-sm font-semibold ${
                    isOthers ? 'text-gray-500' : 'text-gray-700'
                  }`}>
                    {source.shareOfVoice.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderIconTabs = () => {
    return (
      <div className="flex space-x-1">
        <button
          onClick={() => setActiveTab('mentions')}
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium transition-all duration-200 ${
            activeTab === 'mentions'
              ? 'bg-white/60 backdrop-blur-sm border border-white/30 shadow-inner text-gray-900'
              : 'bg-white/80 backdrop-blur-sm border border-white/20 shadow-md text-gray-500 hover:text-gray-700 hover:bg-white/85'
          }`}
          title="Mentions"
        >
          @
        </button>
        <button
          onClick={() => setActiveTab('citations')}
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium transition-all duration-200 ${
            activeTab === 'citations'
              ? 'bg-white/60 backdrop-blur-sm border border-white/30 shadow-inner text-gray-900'
              : 'bg-white/80 backdrop-blur-sm border border-white/20 shadow-md text-gray-500 hover:text-gray-700 hover:bg-white/85'
          }`}
          title="Citations"
        >
          [ ]
        </button>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'mentions':
        return renderMentionsView();
      case 'citations':
        return renderCitationsView();
      default:
        return renderMentionsView();
    }
  };

  return (
    <LiquidGlassCard>
      <div className="flex flex-col lg:flex-row h-full w-full">
        <div className="w-full lg:w-1/2 pr-0 lg:pr-4 border-r-0 lg:border-r border-b lg:border-b-0 border-gray-200 flex flex-col pb-4 lg:pb-0 mb-4 lg:mb-0">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Industry Ranking</h3>
          {renderIndustryRanking()}
        </div>
        <div className="w-full lg:w-1/2 pl-0 lg:pl-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              {activeTab === 'mentions' ? 'Mentions' : 'Citations'}
            </h3>
            {renderIconTabs()}
          </div>
          {renderTabContent()}
        </div>
      </div>
    </LiquidGlassCard>
  );
};

export default RankingsCard;  