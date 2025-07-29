/**
 * @file MockSentimentOverTimeCard.tsx
 * @description This component displays a mock sentiment score trend over time using an area chart.
 * It visualizes how the brand's sentiment score has evolved, providing insights into the impact
 * of various events or campaigns on public perception. This card is used to demonstrate historical
 * sentiment analysis capabilities on the landing page.
 *
 * @dependencies
 * - react: For core React functionalities.
 * - recharts: For charting components such as `AreaChart`, `Area`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, and `ResponsiveContainer`.
 * - ./MockDashboardCard: Generic card component for consistent UI in the mock dashboard.
 *
 * @exports
 * - MockSentimentOverTimeCard: React functional component for displaying mock sentiment over time.
 */
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import MockDashboardCard from './MockDashboardCard';
import { useMediaQuery } from '../../../../hooks/useMediaQuery';

const mockReportMetric = {
    sentimentOverTime: [
        { date: 'Jul 1', score: 7.2 },
        { date: 'Jul 8', score: 7.8 },
        { date: 'Jul 15', score: 8.5 },
        { date: 'Jul 22', score: 8.8 },
        { date: 'Jul 28', score: 8.9 },
    ],
};

const MockSentimentOverTimeCard: React.FC = () => {
  const data = mockReportMetric.sentimentOverTime;
  const isMediumScreen = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");

  return (
    <MockDashboardCard>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Sentiment Over Time</h3>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          All Models
        </span>
      </div>
      <div className="flex-1 w-full" style={{ minHeight: isMediumScreen ? '150px' : '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={isMediumScreen ? { top: 10, right: 20, bottom: 10, left: 15 } : { top: 20, right: 30, bottom: 15, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeWidth={1} />
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickMargin={5}
              interval={0}
              angle={0}
              height={40}
            />
            <YAxis 
              domain={[0, 10]}
              ticks={[0, 2, 4, 6, 8, 10]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickFormatter={(value) => value.toFixed(1)}
              width={40}
            />
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
              formatter={(value: number) => [`${value.toFixed(1)}/10`, 'Average Score']}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#2563eb"
              strokeWidth={2}
              fill="url(#sentimentGradient)"
              dot={false}
              activeDot={{ 
                r: 4, 
                stroke: '#2563eb',
                strokeWidth: 2,
                fill: '#ffffff'
              }}
            />
            <defs>
              <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0.05} />
              </linearGradient>
            </defs>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </MockDashboardCard>
  );
};

export default MockSentimentOverTimeCard; 