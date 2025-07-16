/**
 * @file MockSentimentAnalysisPage.tsx
 * @description This component renders a mock page for sentiment analysis within the dashboard preview.
 * It displays key sentiment metrics, sentiment trends over time, and detailed sentiment breakdowns
 * through a grid of mock cards. This page is designed to showcase the application's capabilities
 * in analyzing brand sentiment in AI-generated content on the landing page.
 *
 * @dependencies
 * - react: For core React functionalities.
 * - lucide-react: For icons such as `Calendar`, `Sparkles`, and `RefreshCw`.
 * - ../MockDashboardLayout: The layout component for the mock dashboard.
 * - ../cards/*: Various mock card components used to display sentiment-related metrics.
 * - ../MockFilterDropdown: Mock component for filter dropdowns.
 *
 * @exports
 * - MockSentimentAnalysisPage: The React functional component for the mock sentiment analysis page.
 */
import React from 'react';
import { Calendar, Sparkles, RefreshCw } from 'lucide-react';
import MockDashboardLayout from '../MockDashboardLayout';
import MockSentimentScoreDisplayCard from '../cards/MockSentimentScoreDisplayCard';
import MockSentimentOverTimeCard from '../cards/MockSentimentOverTimeCard';
import MockSentimentDetailsCard from '../cards/MockSentimentDetailsCard';
import MockFilterDropdown from '../MockFilterDropdown';

const dateRangeOptions = [
  { value: '30d', label: 'Last 30 days' },
  { value: '7d', label: 'Last 7 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' },
];

const aiModelOptions = [
    { value: 'all', label: 'All AI Models', icon: Sparkles },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { value: 'gpt-4-1106-preview', label: 'GPT-4 Turbo' },
    { value: 'gemini-1.0-pro-001', label: 'Gemini 1.0 Pro' },
    { value: 'mistral-large-latest', label: 'Mistral Large' },
];

const MockSentimentAnalysisPage: React.FC = () => {
  return (
    <MockDashboardLayout activePage="Sentiment Analysis">
      <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sentiment Analysis</h1>
          <p className="text-sm text-gray-500 mt-1">
            Last updated: 6/28/2025, 5:05:00 AM
          </p>
        </div>
        <div className="grid grid-cols-2 lg:flex items-center gap-2 w-full lg:w-auto">
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
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#7762ff] text-white rounded-lg hover:bg-[#6650e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium col-span-2"
          >
            <RefreshCw size={16} />
            <span className="whitespace-nowrap">Refresh data</span>
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 p-1">
        <div className="flex flex-col lg:grid h-full w-full gap-4" style={{
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
            "d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1"
          `
        }}>
          <div style={{ gridArea: 's1' }}><MockSentimentScoreDisplayCard /></div>
          <div style={{ gridArea: 's2' }}><MockSentimentOverTimeCard /></div>
          <div style={{ gridArea: 'd1' }}><MockSentimentDetailsCard /></div>
        </div>
      </div>
    </MockDashboardLayout>
  );
};

export default MockSentimentAnalysisPage; 