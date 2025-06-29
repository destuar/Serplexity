import React from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Scatter } from 'recharts';
import MockDashboardCard from './MockDashboardCard';

const mockShareOfVoiceHistory = [
    { date: 'Jun 1', shareOfVoice: 5.2 },
    { date: 'Jun 8', shareOfVoice: 8.5 },
    { date: 'Jun 15', shareOfVoice: 16.1 },
    { date: 'Jun 22', shareOfVoice: 29.8 },
    { date: 'Jun 28', shareOfVoice: 38.5 },
];

const MockVisibilityOverTimeCard: React.FC = () => {
  const chartData = mockShareOfVoiceHistory;

  return (
    <MockDashboardCard>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">Visibility Over Time</h3>
      <div className="flex-1 min-h-0 -ml-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 15, bottom: -15, left: 20 }}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#e2e8f0" 
              strokeWidth={1}
              horizontalPoints={[0]}
            />
            <XAxis 
              dataKey="date" 
              axisLine={{ stroke: '#e2e8f0', strokeWidth: 1 }}
              tickLine={false}
              tick={{ fontSize: 9, fill: '#64748b' }}
              tickMargin={0}
            />
            <YAxis 
              domain={[0, 100]}
              axisLine={{ stroke: '#e2e8f0', strokeWidth: 1 }}
              tickLine={false}
              tick={{ fontSize: 9, fill: '#64748b' }}
              ticks={[0, 20, 40, 60, 80, 100]}
              tickFormatter={(value) => `${value}%`}
              width={25}
              interval={0}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
              itemStyle={{ color: '#374151' }}
              labelStyle={{ color: '#1f2937', fontWeight: 'bold' }}
              formatter={(value: number) => [`${value.toFixed(1)}%`, 'Share of Voice']}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="shareOfVoice"
              stroke="#7762ff"
              strokeWidth={chartData.length > 1 ? 2 : 0}
              dot={{ 
                fill: '#7762ff', 
                strokeWidth: 1, 
                r: 2,
                stroke: '#ffffff'
              }}
              activeDot={{ 
                r: 4, 
                stroke: '#7762ff',
                strokeWidth: 1,
                fill: '#ffffff'
              }}
            />
            {chartData.length === 1 && <Scatter dataKey="shareOfVoice" fill="#7762ff" />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </MockDashboardCard>
  );
};

export default MockVisibilityOverTimeCard; 