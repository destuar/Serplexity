/**
 * @file MockSentimentAnalysisPage.tsx
 * @description This component renders a mock page for sentiment analysis within the dashboard preview.
 * It displays key sentiment metrics, sentiment trends over time, and detailed sentiment breakdowns
 * through a grid of mock cards. This page matches the actual SentimentAnalysisPage layout with
 * proper filter controls, loading states, and responsive design.
 *
 * @dependencies
 * - react: For core React functionalities.
 * - lucide-react: For icons such as `Calendar`, `Sparkles`, `RefreshCw`, and `Loader`.
 * - ../MockDashboardLayout: The layout component for the mock dashboard.
 * - ../cards/*: Various mock card components used to display sentiment-related metrics.
 * - ../MockFilterDropdown: Mock component for filter dropdowns.
 *
 * @exports
 * - MockSentimentAnalysisPage: The React functional component for the mock sentiment analysis page.
 */
import React from 'react';
import { Calendar, Sparkles, RefreshCw, Loader as _Loader } from 'lucide-react';
import MockDashboardLayout from '../MockDashboardLayout';
import MockSentimentScoreDisplayCard from '../cards/MockSentimentScoreDisplayCard';
import MockSentimentOverTimeCard from '../cards/MockSentimentOverTimeCard';
import MockSentimentDetailsCard from '../cards/MockSentimentDetailsCard';
import MockFilterDropdown from '../MockFilterDropdown';
import { MODEL_CONFIGS, ModelConfig } from '../../../../types/dashboard';

const dateRangeOptions = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' },
];

const aiModelOptions = [
    { value: 'all', label: 'All Models', icon: Sparkles },
    ...(Object.values(MODEL_CONFIGS) as ModelConfig[]).map(model => ({
        value: model.id,
        label: model.displayName,
        logoUrl: model.logoUrl,
    }))
];

const MockSentimentAnalysisPage: React.FC = () => {
  return (
    <MockDashboardLayout activePage="Dashboard → Sentiment">
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-2">
          <div className="flex items-center gap-2">
            <MockFilterDropdown
              label="Date Range"
              value={'30d'}
              options={dateRangeOptions}
              icon={Calendar}
            />
            <MockFilterDropdown
              label="AI Model"
              value={'all'}
              options={aiModelOptions}
              icon={Sparkles}
            />
            <button 
              disabled
              className="flex items-center justify-center gap-2 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 active:shadow-inner"
            >
              <RefreshCw size={16} />
              <span className="whitespace-nowrap">Refresh Data</span>
            </button>
          </div>
          <p className="text-sm text-gray-500">
            Last updated: {new Date().toLocaleString()}
          </p>
        </div>
        
        <div className="flex-1 min-h-0 p-1 relative">
          <div className="h-full w-full">
            <div className="lg:hidden h-full overflow-y-auto space-y-4">
              <div className="min-h-[300px]">
                <MockSentimentScoreDisplayCard />
              </div>
              <div className="min-h-[300px]">
                <MockSentimentOverTimeCard />
              </div>
              <div className="min-h-[400px]">
                <MockSentimentDetailsCard />
              </div>
            </div>

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
              <div style={{ gridArea: 's1' }}><MockSentimentScoreDisplayCard /></div>
              <div style={{ gridArea: 's2' }}><MockSentimentOverTimeCard /></div>
              <div style={{ gridArea: 'd1' }}><MockSentimentDetailsCard /></div>
            </div>
          </div>
        </div>
      </div>
    </MockDashboardLayout>
  );
};

export default MockSentimentAnalysisPage; 