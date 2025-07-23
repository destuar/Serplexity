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

type TabType = 'mentions' | 'citations';

const RankingsCard = () => {
  const { data, loading: _loading, error, acceptedCompetitors } = useDashboard();
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const isTallerScreen = useMediaQuery('(min-height: 900px)');
  const [activeTab, setActiveTab] = useState<TabType>('mentions');



  // Data is now pre-calculated on the backend
  const rankingsData = data?.competitorRankings;
  const citationData = data?.citationRankings;

  // Filter competitor rankings to only show accepted competitors
  const filteredRankingsData = useMemo(() => {
    if (!rankingsData) {
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

    // Filter competitors to only include accepted ones
    const filteredCompetitors = rankingsData.competitors?.filter(competitor => 
      competitor.isUserCompany || acceptedNames.has(competitor.name.toLowerCase().trim())
    ) || [];

    const filteredChartCompetitors = rankingsData.chartCompetitors?.filter(competitor => 
      competitor.isUserCompany || acceptedNames.has(competitor.name.toLowerCase().trim())
    ) || [];

    return {
      ...rankingsData,
      competitors: filteredCompetitors,
      chartCompetitors: filteredChartCompetitors,
    };
  }, [rankingsData, acceptedCompetitors, selectedCompany?.id]);

    // Define the competitor type based on companyService structure
    type Competitor = {
      name: string;
      website?: string;
      shareOfVoice: number;
      change?: number;
      changeType?: 'increase' | 'decrease' | 'stable';
      isUserCompany: boolean;
    };

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

    // If company has no ranking (not mentioned), show N/A
    if (!rankingsData?.industryRanking) {
      const chartData = rankingsData?.chartCompetitors || [];
      const displayedChartData = chartData.slice(0, Math.min(12, chartData.length));
      
      return (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-5xl font-bold text-gray-800 mb-6">
            N/A
          </div>
          <div className="flex items-end justify-center space-x-1 h-16 w-full max-w-64">
            {displayedChartData.length > 0 ? (
              displayedChartData.map((competitor: Competitor, index: number) => {
                const maxShareOfVoice = Math.max(...displayedChartData.map((c: Competitor) => c.shareOfVoice));
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
                    title={`${competitor.name}: ${competitor.shareOfVoice.toFixed(1)}%`}
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

    // Chart logic is now simplified as data is pre-calculated.
    const chartData = filteredRankingsData?.chartCompetitors || [];
    // Show up to 12 competitors, or all available if fewer than 12
    const displayedChartData = chartData.slice(0, Math.min(12, chartData.length));
    const maxShareOfVoice = displayedChartData.length > 0 ? Math.max(...displayedChartData.map((c: Competitor) => c.shareOfVoice)) : 0;
    
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="text-6xl font-bold text-gray-800 mb-6">
        {filteredRankingsData?.industryRanking}
        <span className="text-xl font-normal text-gray-500">{getOrdinalSuffix(filteredRankingsData?.industryRanking || 0)}</span>
      </div>
        <div className="flex items-end justify-center space-x-1 h-16 w-full max-w-64">
          {displayedChartData.map((competitor: Competitor, index: number) => {
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
                title={`${competitor.name}: ${competitor.shareOfVoice.toFixed(1)}%`}
              />
            );
          })}
        </div>

      </div>
    );
  };

  const renderMentionsView = () => {
    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Error loading data</p>
        </div>
      );
    }

    // Use chartCompetitors to include the user's company
    if (!filteredRankingsData || !filteredRankingsData.chartCompetitors || filteredRankingsData.chartCompetitors.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">No competitor mentions found</p>
        </div>
      );
    }

    const numCompetitorsToShow = isTallerScreen ? 4 : 3;

    // Show only top 3 entities (including user company), then "X+ others" if there are more
    const allCompetitors = filteredRankingsData.chartCompetitors;
    const topCompetitors = allCompetitors.slice(0, numCompetitorsToShow);
    const remainingCompetitors = allCompetitors.slice(numCompetitorsToShow);
    const remainingCount = remainingCompetitors.length;
    
    // Calculate combined share of voice for remaining competitors
    const remainingShareOfVoice = remainingCompetitors.reduce((total: number, competitor: Competitor) => total + competitor.shareOfVoice, 0);
    
    // Create the display list
    const displayCompetitors = [...topCompetitors];
    if (remainingCount > 0) {
      // Add "X+ others" entry with combined percentage
      displayCompetitors.push({
        name: `${remainingCount}+ others`,
        shareOfVoice: remainingShareOfVoice,
        change: 0,
        changeType: 'stable' as const,
        isUserCompany: false,
        website: undefined
      });
    }

    return (
      <div className="flex-1 space-y-2">
        {displayCompetitors.map((competitor: Competitor | { name: string; shareOfVoice: number; change: number; changeType: 'stable'; isUserCompany: boolean; website?: string }, index: number) => {
          const logoResult = competitor.website ? getCompanyLogo(competitor.website) : null;
          const isOthers = competitor.name.includes('others');
          
          return (
            <div 
              key={`${competitor.name}-${index}`} 
              className={`flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-gray-50 ${
                isOthers ? 'cursor-pointer' : ''
              }`}
              onClick={isOthers ? () => navigate('/competitor-rankings') : undefined}
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

    // If we have more sources than available slots, reserve the last slot for "X+ others"
    let displaySources: (Citation | { domain: string; name: string; shareOfVoice: number; citationCount: number; uniqueUrls: number; sampleTitle: string })[];
    if (allSources.length > maxSlots) {
      const topSources = allSources.slice(0, maxSlots - 1);
      const remainingSources = allSources.slice(maxSlots - 1);
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
      <div className="flex-1 space-y-2">
        {displaySources.map((source: Citation, index: number) => {
          const isOthers = source.domain.includes('others');
          
          return (
            <div 
              key={`${source.domain}-${index}`} 
              className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-gray-50"
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

  const renderTabButtons = () => {
    return (
      <div className="flex bg-gray-100 rounded-lg p-1 mb-2">
        <button
          onClick={() => setActiveTab('mentions')}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
            activeTab === 'mentions'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Mentions
        </button>
        <button
          onClick={() => setActiveTab('citations')}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
            activeTab === 'citations'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Citations
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
          {renderTabButtons()}
          {renderTabContent()}
        </div>
      </div>
    </LiquidGlassCard>
  );
};

export default RankingsCard;  