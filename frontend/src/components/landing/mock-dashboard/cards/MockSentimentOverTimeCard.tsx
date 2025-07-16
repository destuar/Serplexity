/**
 * @file MockSentimentOverTimeCard.tsx
 * @description This component displays a mock sentiment score trend over time using a line chart.
 * It visualizes how the brand's sentiment score has evolved, providing insights into the impact
 * of various events or campaigns on public perception. This card is used to demonstrate historical
 * sentiment analysis capabilities on the landing page.
 *
 * @dependencies
 * - react: For core React functionalities.
 * - recharts: For charting components such as `LineChart`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, and `ResponsiveContainer`.
 * - ./MockDashboardCard: Generic card component for consistent UI in the mock dashboard.
 *
 * @exports
 * - MockSentimentOverTimeCard: React functional component for displaying mock sentiment over time.
 */
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import MockDashboardCard from './MockDashboardCard';

const mockReportMetric = {
    sentimentOverTime: [
        { date: 'Jun 1', score: 7.2 },
        { date: 'Jun 8', score: 7.8 },
        { date: 'Jun 15', score: 8.5 },
        { date: 'Jun 22', score: 8.8 },
        { date: 'Jun 28', score: 8.9 },
    ],
};

const MockSentimentOverTimeCard: React.FC = () => {
  const data = mockReportMetric.sentimentOverTime;

  return (
    <MockDashboardCard>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Sentiment Over Time</h3>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          All Models
        </span>
      </div>
      <div className="flex-1 w-full" style={{ minHeight: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, bottom: 15, left: 20 }}>
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
            <Line 
              type="monotone" 
              dataKey="score" 
              stroke="#7762ff" 
              strokeWidth={3} 
              dot={{ 
                fill: '#7762ff', 
                strokeWidth: 2, 
                r: 5,
                stroke: '#ffffff'
              }} 
              activeDot={{ 
                r: 7, 
                stroke: '#7762ff',
                strokeWidth: 2,
                fill: '#ffffff'
              }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </MockDashboardCard>
  );
};

export default MockSentimentOverTimeCard; 