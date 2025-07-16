/**
 * @file MockCompetitorRankingsPage.tsx
 * @description This component renders a mock page displaying competitor rankings within the dashboard preview.
 * It simulates a view where users can see how their company ranks against competitors based on various metrics
 * like Share of Voice. It includes mock data, filter dropdowns, and a refresh button for demonstration purposes.
 * This page is a key part of the landing page's interactive dashboard preview.
 *
 * @dependencies
 * - react: For core React functionalities.
 * - lucide-react: For icons such as `ExternalLink`, `Sparkles`, `TrendingUp`, `ArrowUpDown`, `RefreshCw`,
 *   `ChevronUp`, and `ChevronDown`.
 * - ../MockDashboardLayout: The layout component for the mock dashboard.
 * - ../../../../lib/utils: For the `cn` utility function to conditionally join CSS class names.
 * - ../MockFilterDropdown: Mock component for filter dropdowns.
 * - ../../../../lib/logoService: Utility to get company logos.
 *
 * @exports
 * - MockCompetitorRankingsPage: The React functional component for the mock competitor rankings page.
 */
import React from 'react';
import { ExternalLink, Sparkles, TrendingUp, ArrowUpDown, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import MockDashboardLayout from '../MockDashboardLayout';
import { cn } from '../../../../lib/utils';
import MockFilterDropdown from '../MockFilterDropdown';
import { getCompanyLogo } from '../../../../lib/logoService';

const mockCompetitors = [
    { rank: 1, name: 'Serplexity', isUserCompany: true, website: 'serplexity.com', shareOfVoice: 38.5, change: 2.1, changeType: 'increase' as const },
    { rank: 2, name: 'Athena', isUserCompany: false, website: 'athenahq.ai', shareOfVoice: 10.8, change: 1.8, changeType: 'increase' as const },
    { rank: 3, name: 'Writesonic', isUserCompany: false, website: 'writesonic.com', shareOfVoice: 9.1, change: -0.5, changeType: 'decrease' as const },
    { rank: 4, name: 'Semrush', isUserCompany: false, website: 'semrush.com', shareOfVoice: 8.1, change: 1.2, changeType: 'increase' as const },
    { rank: 5, name: 'Cognizo', isUserCompany: false, website: 'cognizo.ai', shareOfVoice: 7.2, change: 2.5, changeType: 'increase' as const },
    { rank: 6, name: 'Daydream', isUserCompany: false, website: 'withdaydream.com', shareOfVoice: 6.4, change: 0.2, changeType: 'increase' as const },
    { rank: 7, name: 'Goodie', isUserCompany: false, website: 'higoodie.com', shareOfVoice: 5.3, change: -1.1, changeType: 'decrease' as const },
    { rank: 8, name: 'Profound', isUserCompany: false, website: 'tryprofound.com', shareOfVoice: 4.3, change: 0.9, changeType: 'increase' as const },
    { rank: 9, name: 'Xfunnel', isUserCompany: false, website: 'xfunnel.ai', shareOfVoice: 3.4, change: 0.0, changeType: 'neutral' as const },
    { rank: 10, name: 'AI SEO Tracker', isUserCompany: false, website: 'aiseotracker.com', shareOfVoice: 2.9, change: 0.4, changeType: 'increase' as const },
    { rank: 11, name: 'AIPageReady', isUserCompany: false, website: 'aipageready.com', shareOfVoice: 2.1, change: -0.3, changeType: 'decrease' as const },
    { rank: 12, name: 'Relixir', isUserCompany: false, website: 'relixir.ai', shareOfVoice: 1.9, change: 0.1, changeType: 'increase' as const },
];

const aiModelOptions = [
    { value: 'all', label: 'All AI Models' },
    { value: 'openai/gpt-4o', label: 'GPT-4o' },
    { value: 'google/gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'anthropic/claude-3-opus', label: 'Claude 3 Opus' },
];

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

const getChangeDisplay = (change: number, changeType: string) => {
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

const MockCompetitorRankingsPage: React.FC = () => {
    const renderCompetitorCard = (competitor: (typeof mockCompetitors)[0]) => {
        const logoResult = competitor.website ? getCompanyLogo(competitor.website) : null;
        
        return (
          <div
            key={competitor.name}
            className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-4 min-w-0 flex-1 mr-4">
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full text-lg font-bold flex-shrink-0",
                  competitor.isUserCompany ? "bg-[#7762ff] text-white" : "bg-gray-100 text-gray-600"
                )}>
                  {competitor.rank}
                </div>
    
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-white flex-shrink-0">
                    {logoResult ? (
                      <img
                        src={logoResult.url}
                        alt={`${competitor.name} logo`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const nextEl = e.currentTarget.nextElementSibling;
                          if (nextEl) nextEl.setAttribute('style', 'display: flex');
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
                        href={`https://${competitor.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center mt-1 truncate"
                      >
                        <span className="truncate">{competitor.website}</span>
                        <ExternalLink size={12} className="ml-1 flex-shrink-0" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
    
              <div className="text-right flex-shrink-0">
                <div className="text-2xl font-bold text-gray-900">
                  {competitor.shareOfVoice.toFixed(1)}%
                </div>
                <div className="mt-1">
                  {getChangeDisplay(competitor.change, competitor.changeType)}
                </div>
              </div>
            </div>
    
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
    <MockDashboardLayout activePage="Competitor Rankings">
        <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Competitor Rankings</h1>
              <p className="text-sm text-gray-500 mt-1">
                Last updated: 6/28/2025, 5:05:00 AM
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex items-center gap-2 w-full lg:w-auto">
                <MockFilterDropdown
                    label="Show"
                    value={'10'}
                    options={displayLimitOptions}
                    icon={TrendingUp}
                />
                <MockFilterDropdown
                    label="Sort by"
                    value={'shareOfVoice'}
                    options={sortOptions}
                    icon={ArrowUpDown}
                />
                <MockFilterDropdown
                    label="AI Model"
                    value={'all'}
                    options={aiModelOptions}
                    icon={Sparkles}
                />
                <button 
                    disabled
                    className="flex items-center justify-center w-full md:w-auto gap-2 px-4 py-2 bg-[#7762ff] text-white rounded-lg hover:bg-[#6650e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium col-span-2 sm:col-span-1"
                >
                    <RefreshCw size={16} />
                    <span className="whitespace-nowrap">Refresh data</span>
                </button>
            </div>
        </div>
      
        <div className="flex-1 min-h-0 p-1">
            <div className="h-full w-full">
                <div className="h-full overflow-y-auto space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 pb-6">
                      {mockCompetitors.map((competitor) => 
                        renderCompetitorCard(competitor)
                      )}
                    </div>
                </div>
            </div>
        </div>
    </MockDashboardLayout>
  );
};

export default MockCompetitorRankingsPage; 