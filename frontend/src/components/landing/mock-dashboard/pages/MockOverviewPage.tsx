/**
 * @file MockOverviewPage.tsx
 * @description This component renders a mock overview page for the dashboard preview, simulating the main dashboard view.
 * It displays various key metrics and insights through a grid of mock cards, including brand share of voice,
 * visibility over time, average inclusion rate, average position, sentiment score, top ranking questions, and rankings.
 * This page serves as a comprehensive demonstration of the dashboard's capabilities on the landing page.
 *
 * @dependencies
 * - react: For core React functionalities.
 * - lucide-react: For icons such as `Calendar`, `Sparkles`, and `RefreshCw`.
 * - ../MockDashboardLayout: The layout component for the mock dashboard.
 * - ../cards/*: Various mock card components used to display different metrics.
 * - ../MockFilterDropdown: Mock component for filter dropdowns.
 * - ../../../../types/dashboard: Contains `MODEL_CONFIGS` and `ModelConfig` for model-related data.
 *
 * @exports
 * - MockOverviewPage: The React functional component for the mock overview page.
 */
import React from 'react';
import { Calendar, Sparkles, RefreshCw } from 'lucide-react';
import MockDashboardLayout from '../MockDashboardLayout';
import MockVisibilityOverTimeCard from '../cards/MockVisibilityOverTimeCard';
import MockSentimentScoreDisplayCard from '../cards/MockSentimentScoreDisplayCard';
import MockTopRankingQuestionsCard from '../cards/MockTopRankingQuestionsCard';
import MockRankingsCard from '../cards/MockRankingsCard';
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
    }))
];

const MockOverviewPage: React.FC = () => {
  return (
    <MockDashboardLayout activePage="Dashboard">
      {/* Header Section - Match exact pattern from OverviewPage.tsx */}
      <div className="flex-shrink-0 flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-2">
        <div className="grid grid-cols-2 md:flex lg:flex items-center gap-2 w-full md:w-auto lg:w-auto">
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
            disabled={true}
            className="flex items-center justify-center w-full md:w-auto lg:w-auto gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium col-span-2 md:col-span-1 hover:bg-white/85 focus:outline-none focus:ring-2 focus:ring-black"
          >
            <RefreshCw size={16} />
            <span className="whitespace-nowrap">Refresh Data</span>
          </button>
        </div>
        <div className="flex-shrink-0">
          <p className="text-sm text-gray-500">
            Last updated: {new Date().toLocaleString()}
          </p>
        </div>
      </div>
      
      {/* Grid layout matching real OverviewPage.tsx */}
      <div className="flex-1 min-h-0 p-1 relative">
        <div className="h-full w-full">
          <div className="hidden md:grid h-full w-full gap-4" style={{
            gridTemplateColumns: 'repeat(48, 1fr)',
            gridTemplateRows: 'repeat(10, minmax(30px, 1fr))',
            gridTemplateAreas: `
              "metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
              "metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
              "metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
              "metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
              "metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics metrics s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
              "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
              "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
              "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
              "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
              "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
            `
          }}>
            <div style={{ gridArea: 'metrics' }}><MockVisibilityOverTimeCard /></div>
            <div style={{ gridArea: 's1' }}><MockSentimentScoreDisplayCard /></div>
            <div style={{ gridArea: 'q1' }}><MockTopRankingQuestionsCard /></div>
            <div style={{ gridArea: 'r1' }}><MockRankingsCard /></div>
          </div>
          
          {/* Mobile Layout */}
          <div className="md:hidden h-full overflow-y-auto space-y-4">
            <div className="min-h-[400px]">
              <MockVisibilityOverTimeCard />
            </div>
            <div className="min-h-[300px]">
              <MockSentimentScoreDisplayCard />
            </div>
            <div className="min-h-[300px]">
              <MockTopRankingQuestionsCard />
            </div>
            <div className="min-h-[200px]">
              <MockRankingsCard />
            </div>
          </div>
        </div>
      </div>
    </MockDashboardLayout>
  );
};

export default MockOverviewPage; 