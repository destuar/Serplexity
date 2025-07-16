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
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../ui/Card';
import { useDashboard } from '../../hooks/useDashboard';
import { getCompanyLogo } from '../../lib/logoService';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const RankingsCard = () => {
  const { data, loading, error } = useDashboard();
  const navigate = useNavigate();
  const isTallerScreen = useMediaQuery('(min-height: 900px)');

      // Data is now pre-calculated on the backend
    const rankingsData = data?.competitorRankings;

    // Define the competitor type based on companyService structure
    type Competitor = {
      name: string;
      website?: string;
      shareOfVoice: number;
      change?: number;
      changeType?: 'increase' | 'decrease' | 'stable';
      isUserCompany: boolean;
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
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      );
    }

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
                      ${isUserCompany ? 'bg-[#7762ff]' : 'bg-gray-300'}
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
    const chartData = rankingsData.chartCompetitors || [];
    // Show up to 12 competitors, or all available if fewer than 12
    const displayedChartData = chartData.slice(0, Math.min(12, chartData.length));
    const maxShareOfVoice = displayedChartData.length > 0 ? Math.max(...displayedChartData.map((c: Competitor) => c.shareOfVoice)) : 0;
    
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-6xl font-bold text-gray-800 mb-6">
          {rankingsData.industryRanking}
          <span className="text-xl font-normal text-gray-500">{getOrdinalSuffix(rankingsData.industryRanking)}</span>
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
                className={`
                  w-3 rounded-t transition-all duration-300
                  ${isUserCompany ? 'bg-[#7762ff]' : 'bg-gray-300'}
                `}
                style={{ height: `${heightPx}px` }}
                title={`${competitor.name}: ${competitor.shareOfVoice.toFixed(1)}%`}
              />
            );
          })}
        </div>

      </div>
    );
  };

  const renderCompetitorsList = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Error loading data</p>
        </div>
      );
    }

    // Use chartCompetitors to include the user's company
    if (!rankingsData || !rankingsData.chartCompetitors || rankingsData.chartCompetitors.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">No competitor mentions found</p>
        </div>
      );
    }

    const numCompetitorsToShow = isTallerScreen ? 4 : 3;

    // Show only top 3 entities (including user company), then "X+ others" if there are more
    const allCompetitors = rankingsData.chartCompetitors;
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
          const isUserCompany = competitor.isUserCompany;
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
                <span className={`text-sm font-medium w-4 flex-shrink-0 ${
                  isUserCompany ? 'text-[#7762ff]' : 'text-gray-600'
                }`}>{index + 1}.</span>
                
                {/* Company Logo - don't show for Others */}
                {!isOthers && (
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                    {logoResult ? (
                      <img
                        src={logoResult.url}
                        alt={`${competitor.name} logo`}
                        className="w-full h-full object-cover"
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
                    isOthers ? 'text-gray-500 italic hover:underline' : isUserCompany ? 'text-[#7762ff]' : 'text-gray-800'
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
                    isUserCompany ? 'text-[#7762ff]' : isOthers ? 'text-gray-500' : 'text-gray-700'
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

  return (
    <Card>
      <div className="flex flex-col lg:flex-row h-full w-full">
        <div className="w-full lg:w-1/2 pr-0 lg:pr-4 border-r-0 lg:border-r border-b lg:border-b-0 border-gray-200 flex flex-col pb-4 lg:pb-0 mb-4 lg:mb-0">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Industry Ranking</h3>
          {renderIndustryRanking()}
        </div>
        <div className="w-full lg:w-1/2 pl-0 lg:pl-4 flex flex-col">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Competitors</h3>
          {renderCompetitorsList()}
        </div>
      </div>
    </Card>
  );
};

export default RankingsCard;  