/**
 * @file MockBrandShareOfVoiceCard.tsx
 * @description This component displays a mock brand share of voice using a pie chart.
 * It visualizes the percentage of mentions for the brand compared to others in AI-generated responses.
 * This card is used to demonstrate key visibility metrics on the landing page.
 *
 * @dependencies
 * - react: For core React functionalities.
 * - recharts: For charting components such as `PieChart`, `Pie`, `Cell`, `ResponsiveContainer`, and `Tooltip`.
 * - ./MockDashboardCard: Generic card component for consistent UI in the mock dashboard.
 *
 * @exports
 * - MockBrandShareOfVoiceCard: React functional component for displaying the mock brand share of voice.
 */
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import MockDashboardCard from './MockDashboardCard';

const COLORS = ['#7762ff', '#e5e7eb'];

const MOCK_COMPANY_NAME = 'Serplexity';
const MOCK_SHARE_OF_VOICE = 38.5;

const chartData = [
  { name: MOCK_COMPANY_NAME, value: MOCK_SHARE_OF_VOICE },
  { name: 'Others', value: 100 - MOCK_SHARE_OF_VOICE },
];

const MockBrandShareOfVoiceCard: React.FC = () => {
  return (
    <MockDashboardCard>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">Share of Voice</h3>
      <div className="flex-1 flex items-start justify-center pt-1">
        <div className="flex items-center gap-3">
          <div className="w-48 h-44 flex items-center justify-center">
            <ResponsiveContainer width={200} height={160}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  formatter={(value: number, name: string) => [
                      `${value.toFixed(1)}%`,
                      name
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#7762ff' }}></div>
              <span className="text-sm text-gray-600 truncate">{MOCK_COMPANY_NAME}</span>
              <span className="text-sm font-semibold text-gray-800">{MOCK_SHARE_OF_VOICE.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-gray-200 flex-shrink-0"></div>
              <span className="text-sm text-gray-600">Others</span>
              <span className="text-sm font-semibold text-gray-800">{(100 - MOCK_SHARE_OF_VOICE).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>
    </MockDashboardCard>
  );
};

export default MockBrandShareOfVoiceCard;