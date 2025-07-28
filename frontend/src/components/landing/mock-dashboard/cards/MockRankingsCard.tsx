/**
 * @file MockRankingsCard.tsx
 * @description This component displays mock industry rankings and a list of top competitors.
 * It visualizes the brand's position within its industry and provides a quick overview of competitor
 * performance based on Share of Voice. This card is used to demonstrate competitive analysis features
 * on the landing page.
 *
 * @dependencies
 * - react: For core React functionalities.
 * - lucide-react: For icons such as `ChevronUp` and `ChevronDown`.
 * - ./MockDashboardCard: Generic card component for consistent UI in the mock dashboard.
 * - ../../../../lib/logoService: Utility to get company logos.
 *
 * @exports
 * - MockRankingsCard: React functional component for displaying mock industry rankings and competitors.
 */
import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import MockDashboardCard from './MockDashboardCard';
import { getCompanyLogo } from '../../../../lib/logoService';

type TabType = 'mentions' | 'citations';

interface CompetitorData {
    name: string;
    shareOfVoice: number;
    change: number;
    changeType: string;
    isUserCompany: boolean;
    website: string;
}

const mockRankingsData: {
    industryRanking: number;
    chartCompetitors: CompetitorData[];
} = {
    industryRanking: 1,
    chartCompetitors: [
        { name: 'Serplexity', shareOfVoice: 38.5, change: 2.1, changeType: 'increase', isUserCompany: true, website: 'serplexity.com' },
        { name: 'Athena', shareOfVoice: 10.8, change: 1.8, changeType: 'increase', isUserCompany: false, website: 'athenahq.ai' },
        { name: 'Writesonic', shareOfVoice: 9.1, change: -0.5, changeType: 'decrease', isUserCompany: false, website: 'writesonic.com' },
        { name: 'Semrush', shareOfVoice: 8.1, change: 1.2, changeType: 'increase', isUserCompany: false, website: 'semrush.com' },
        { name: 'Cognizo', shareOfVoice: 7.2, change: 2.5, changeType: 'increase', isUserCompany: false, website: 'cognizo.ai' },
        { name: 'Daydream', shareOfVoice: 6.4, change: 0.2, changeType: 'increase', isUserCompany: false, website: 'withdaydream.com' },
        { name: 'Goodie', shareOfVoice: 5.3, change: -1.1, changeType: 'decrease', isUserCompany: false, website: 'higoodie.com' },
        { name: 'Profound', shareOfVoice: 4.3, change: 0.9, changeType: 'increase', isUserCompany: false, website: 'tryprofound.com' },
        { name: 'Xfunnel', shareOfVoice: 3.4, change: 0.0, changeType: 'neutral', isUserCompany: false, website: 'xfunnel.ai' },
        { name: 'AI SEO Tracker', shareOfVoice: 2.9, change: 0.4, changeType: 'increase', isUserCompany: false, website: 'aiseotracker.com' },
        { name: 'AIPageReady', shareOfVoice: 2.1, change: -0.3, changeType: 'decrease', isUserCompany: false, website: 'aipageready.com' },
        { name: 'Relixir', shareOfVoice: 1.9, change: 0.1, changeType: 'increase', isUserCompany: false, website: 'relixir.ai' },
    ]
};

const getOrdinalSuffix = (num: number): string => {
    const j = num % 10, k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
};

const IndustryRanking = () => {
    const { industryRanking, chartCompetitors } = mockRankingsData;
    const maxShareOfVoice = Math.max(...chartCompetitors.map(c => c.shareOfVoice));

    return (
        <div className="flex-1 flex flex-col items-center justify-center h-full">
            <div className="text-6xl font-bold text-gray-800 mb-6">
                {industryRanking}
                <span className="text-lg font-normal text-gray-500">{getOrdinalSuffix(industryRanking)}</span>
            </div>
            <div className="flex items-end justify-center space-x-1 h-24 w-full max-w-48">
                {chartCompetitors.slice(0, 12).map((c, i) => {
                    const height = Math.max(6, (c.shareOfVoice / maxShareOfVoice) * 90);
                    return (
                        <div key={i}
                             className={`w-3 rounded-t ${c.isUserCompany ? 'bg-[#2563eb]' : 'bg-gray-300'}`}
                             style={{ height: `${height}px` }}
                             title={`${c.name}: ${c.shareOfVoice.toFixed(1)}%`}
                        />
                    );
                })}
            </div>
        </div>
    );
};

const CompetitorsList = () => {
    const allCompetitors = mockRankingsData.chartCompetitors;
    const topCompetitors = allCompetitors.slice(0, 4);
    const othersCount = allCompetitors.length - topCompetitors.length;
    
    const displayCompetitors = [...topCompetitors];
    if (othersCount > 0) {
        displayCompetitors.push({
            name: `${othersCount}+ others`,
            shareOfVoice: allCompetitors.slice(4).reduce((acc, c) => acc + c.shareOfVoice, 0),
            change: 0,
            changeType: 'stable',
            isUserCompany: false,
            website: ''
        });
    }

    return (
        <div className="space-y-2 pr-1">
            {displayCompetitors.map((c, i) => {
                const isOthers = c.name.includes('others');
                const logoResult = !isOthers && c.website ? getCompanyLogo(c.website) : null;

                return (
                    <div key={i} className="flex items-center justify-between rounded-md p-1 transition-colors hover:bg-gray-50">
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <span className={`text-xs font-medium w-4 text-center ${c.isUserCompany ? 'text-[#2563eb]' : 'text-gray-600'}`}>{i + 1}.</span>
                            <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-2xs font-semibold text-gray-600 flex-shrink-0 overflow-hidden">
                                {logoResult ? (
                                    <img
                                        src={logoResult.url}
                                        alt={`${c.name} logo`}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    isOthers ? '' : c.name.charAt(0).toUpperCase()
                                )}
                            </div>
                            <span className={`text-xs font-medium truncate ${isOthers ? 'text-gray-500 italic' : c.isUserCompany ? 'text-[#2563eb]' : 'text-gray-800'}`}>{c.name}</span>
                        </div>
                        <div className="flex items-center flex-shrink-0">
                            <div className="w-12 flex justify-start">
                                {!isOthers && (
                                    <div className={`flex items-center text-xs ${c.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {c.change >= 0 ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                        <span className="ml-0.5">{Math.abs(c.change).toFixed(1)}%</span>
                                    </div>
                                )}
                            </div>
                            <div className="w-10 text-right">
                                <span className={`text-xs font-semibold ${c.isUserCompany ? 'text-[#2563eb]' : isOthers ? 'text-gray-500' : 'text-gray-700'}`}>{c.shareOfVoice.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};


const MockRankingsCard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('mentions');

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

    return (
        <MockDashboardCard>
            <div className="flex h-full w-full">
                <div className="w-1/2 pr-4 border-r border-gray-200 flex flex-col">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Industry Ranking</h3>
                    <IndustryRanking />
                </div>
                <div className="w-1/2 pl-4 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800">
                            {activeTab === 'mentions' ? 'Mentions' : 'Citations'}
                        </h3>
                        {renderIconTabs()}
                    </div>
                    <CompetitorsList />
                </div>
            </div>
        </MockDashboardCard>
    );
};

export default MockRankingsCard; 