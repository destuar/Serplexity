/**
 * @file MockSentimentScoreDisplayCard.tsx
 * @description This component displays a mock sentiment score breakdown using a radar chart.
 * It visualizes the brand's sentiment across different categories (e.g., Quality, Price, Reputation),
 * providing a quick visual summary of sentiment strengths and weaknesses. This card is used to
 * demonstrate the application's sentiment analysis capabilities on the landing page.
 *
 * @dependencies
 * - react: For core React functionalities.
 * - recharts: For charting components such as `Radar`, `RadarChart`, `PolarGrid`, `PolarAngleAxis`,
 *   `PolarRadiusAxis`, and `ResponsiveContainer`.
 * - ./MockDashboardCard: Generic card component for consistent UI in the mock dashboard.
 *
 * @exports
 * - MockSentimentScoreDisplayCard: React functional component for displaying the mock sentiment score.
 */
import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import MockDashboardCard from './MockDashboardCard';

const chartData = [
  { category: 'Quality', value: 9.5 },
  { category: 'Price', value: 9.0 },
  { category: 'Reputation', value: 7.9 },
  { category: 'Trust', value: 9.3 },
  { category: 'Service', value: 8.6 },
];

const MockSentimentScoreDisplayCard: React.FC = () => {
  return (
    <MockDashboardCard>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">Sentiment Score</h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart 
            data={chartData} 
            margin={{ top: 5, right: 15, bottom: -15, left: 15 }}
          >
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="category" tick={{ fontSize: 12, fill: '#64748b' }} />
            <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <Radar name="Score" dataKey="value" stroke="#7762ff" fill="#7762ff" fillOpacity={0.1} />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                fontSize: '12px'
              }}
              itemStyle={{ color: '#374151' }}
              labelStyle={{ color: '#1f2937', fontWeight: 'bold' }}
              formatter={(value: number) => [
                `${Number(value).toFixed(1)}/10`,
                null
              ]}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </MockDashboardCard>
  );
};

export default MockSentimentScoreDisplayCard; 