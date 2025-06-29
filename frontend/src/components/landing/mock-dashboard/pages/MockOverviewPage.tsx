import React from 'react';
import { Calendar, Sparkles, RefreshCw } from 'lucide-react';
import MockDashboardLayout from '../MockDashboardLayout';
import MockBrandShareOfVoiceCard from '../cards/MockBrandShareOfVoiceCard';
import MockVisibilityOverTimeCard from '../cards/MockVisibilityOverTimeCard';
import MockAverageInclusionRateCard from '../cards/MockAverageInclusionRateCard';
import MockAveragePositionCard from '../cards/MockAveragePositionCard';
import MockSentimentScoreDisplayCard from '../cards/MockSentimentScoreDisplayCard';
import MockTopRankingQuestionsCard from '../cards/MockTopRankingQuestionsCard';
import MockRankingsCard from '../cards/MockRankingsCard';
import MockFilterDropdown from '../MockFilterDropdown';
import { MODEL_CONFIGS, ModelConfig } from '../../../../types/dashboard';

const dateRangeOptions = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' },
];

const aiModelOptions = [
    { value: 'all', label: 'All AI Models', icon: Sparkles },
    ...(Object.values(MODEL_CONFIGS) as ModelConfig[]).map(model => ({
        value: model.id,
        label: model.displayName,
    }))
];

const MockOverviewPage: React.FC = () => {
  return (
    <MockDashboardLayout activePage="Overview">
      {/* Header Section */}
      <div className="flex-shrink-0 flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
          <p className="text-sm text-gray-500 mt-1">
            Last updated: 6/28/2025, 5:05:00 AM
          </p>
        </div>
        <div className="grid grid-cols-2 md:flex items-center gap-2 w-full md:w-auto">
          <MockFilterDropdown
            label="Date Range"
            value={'7d'}
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
            className="flex items-center justify-center w-full md:w-auto gap-2 px-4 py-2 bg-[#7762ff] text-white rounded-lg disabled:opacity-50 transition-colors text-sm font-medium col-span-2"
          >
            <RefreshCw size={16} />
            <span className="whitespace-nowrap">Refresh data</span>
          </button>
        </div>
      </div>
      
      {/* Grid from real dashboard */}
      <div className="flex-1 min-h-0">
        <div className="grid h-full w-full gap-2" style={{
          gridTemplateColumns: 'repeat(48, 1fr)',
          gridTemplateRows: 'repeat(14, minmax(30px, 1fr))',
          gridTemplateAreas: `
            "m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
            "m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
            "m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
            "m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
            "m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m1 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 m2 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
            "m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
            "m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
            "m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m3 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 m4 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1"
            "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
            "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
            "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
            "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
            "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
            "q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 q1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1 r1"
          `
        }}>
          <div style={{ gridArea: 'm1' }}><MockBrandShareOfVoiceCard /></div>
          <div style={{ gridArea: 'm2' }}><MockVisibilityOverTimeCard /></div>
          <div style={{ gridArea: 'm3' }}><MockAverageInclusionRateCard /></div>
          <div style={{ gridArea: 'm4' }}><MockAveragePositionCard /></div>
          <div style={{ gridArea: 's1' }}><MockSentimentScoreDisplayCard /></div>
          <div style={{ gridArea: 'q1' }}><MockTopRankingQuestionsCard /></div>
          <div style={{ gridArea: 'r1' }}><MockRankingsCard /></div>
        </div>
      </div>
    </MockDashboardLayout>
  );
};

export default MockOverviewPage; 