/**
 * @file MockVisibilityOverTimeCard.tsx
 * @description A component that displays a line chart showing visibility over time on the mock dashboard.
 * This is used on the landing page to demonstrate analytics capabilities.
 *
 * @dependencies
 * - react: For rendering the component.
 * - recharts: For rendering the line chart.
 * - lucide-react: For toggle icons.
 * - ./MockDashboardCard: The wrapper card component.
 *
 * @exports
 * - MockVisibilityOverTimeCard: The main component.
 */
import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { MessageSquare, Eye, Sparkles } from 'lucide-react';
import MockDashboardCard from './MockDashboardCard';

const mockShareOfVoiceHistory = [
    { date: 'Jul 1', shareOfVoice: 5.2, inclusionRate: 12.3 },
    { date: 'Jul 8', shareOfVoice: 8.5, inclusionRate: 18.7 },
    { date: 'Jul 15', shareOfVoice: 16.1, inclusionRate: 25.4 },
    { date: 'Jul 22', shareOfVoice: 29.8, inclusionRate: 41.2 },
    { date: 'Jul 28', shareOfVoice: 38.5, inclusionRate: 52.8 },
];

const MockVisibilityOverTimeCard: React.FC = () => {
  const [selectedMetric, setSelectedMetric] = useState<'shareOfVoice' | 'inclusionRate'>('shareOfVoice');
  const [showModelBreakdown, setShowModelBreakdown] = useState<boolean>(false);
  const chartData = mockShareOfVoiceHistory;
  
  const getMetricLabel = () => {
    return selectedMetric === 'shareOfVoice' ? 'Share of Voice' : 'Inclusion Rate';
  };
  
  const getDataKey = () => {
    return selectedMetric === 'shareOfVoice' ? 'shareOfVoice' : 'inclusionRate';
  };
  
  const getCardTitle = () => {
    return `${getMetricLabel()} Over Time`;
  };

  return (
    <MockDashboardCard>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">{getCardTitle()}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedMetric('shareOfVoice')}
            disabled
            className={`w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation ${
              selectedMetric === 'shareOfVoice'
                ? 'bg-white/60 backdrop-blur-sm border border-white/30 shadow-inner text-gray-900'
                : 'bg-white/80 backdrop-blur-sm border border-white/20 shadow-md text-gray-500 hover:text-gray-700 hover:bg-white/85'
            }`}
            title="Share of Voice"
          >
            <MessageSquare size={14} />
          </button>
          <button
            onClick={() => setSelectedMetric('inclusionRate')}
            disabled
            className={`w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation ${
              selectedMetric === 'inclusionRate'
                ? 'bg-white/60 backdrop-blur-sm border border-white/30 shadow-inner text-gray-900'
                : 'bg-white/80 backdrop-blur-sm border border-white/20 shadow-md text-gray-500 hover:text-gray-700 hover:bg-white/85'
            }`}
            title="Inclusion Rate"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={() => setShowModelBreakdown(!showModelBreakdown)}
            disabled
            className={`w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation ${
              showModelBreakdown
                ? 'bg-white/60 backdrop-blur-sm border border-white/30 shadow-inner text-gray-900'
                : 'bg-white/80 backdrop-blur-sm border border-white/20 shadow-md text-gray-500 hover:text-gray-700 hover:bg-white/85'
            }`}
            title={showModelBreakdown ? "Show aggregated view" : "Break down by model"}
          >
            <Sparkles size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 -ml-4" style={{ minHeight: "200px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 15, bottom: 5, left: 20 }}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#e2e8f0" 
              strokeWidth={1}
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
              formatter={(value: number) => [`${value.toFixed(1)}%`, getMetricLabel()]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Area
              type="monotone"
              dataKey={getDataKey()}
              stroke="#2563eb"
              strokeWidth={2}
              fill="url(#areaGradient)"
              dot={false}
              activeDot={{ 
                r: 4, 
                stroke: '#2563eb',
                strokeWidth: 2,
                fill: '#ffffff'
              }}
            />
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
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

export default MockVisibilityOverTimeCard; 