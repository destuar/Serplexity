/**
 * @file SentimentOverTimeCard.tsx
 * @description This component displays a line chart showing the sentiment score trend over time for the selected company,
 * optionally filtered by AI model. It fetches historical sentiment data from the `useDashboard` hook and visualizes it
 * using `recharts`. It includes dynamic X-axis interval calculation, loading states, and a message for when no historical
 * data is available. This card is crucial for understanding long-term sentiment trends.
 *
 * @dependencies
 * - react: The core React library.
 * - recharts: A customizable charting library for React.
 * - ../ui/Card: Generic card component for consistent UI.
 * - ../../hooks/useDashboard: Custom hook for accessing dashboard data.
 * - ../../types/dashboard: Type definitions and utility for model display names.
 *
 * @exports
 * - SentimentOverTimeCard: React functional component for displaying sentiment trend over time.
 */
import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Scatter } from 'recharts';
import Card from '../ui/Card';
import { useDashboard } from '../../hooks/useDashboard';
import { getModelDisplayName } from '../../types/dashboard';

interface SentimentOverTimeCardProps {
  selectedModel?: string;
}

interface ChartDataPoint {
  date: string;
  score: number;
}

const SentimentOverTimeCard: React.FC<SentimentOverTimeCardProps> = ({ selectedModel = 'all' }) => {
  const { data, loading: _loading } = useDashboard();

  // Filter data by selected model and format for chart
  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!data?.sentimentOverTime || !Array.isArray(data.sentimentOverTime)) {
      return [];
    }

    type SentimentPoint = { date: string; sentimentScore: number; aiModel: string; };
    type ChartPointWithDate = ChartDataPoint & { fullDate: string };

    // Filter by selected model and group by date (one point per day)
    const filteredData = data.sentimentOverTime
      .filter((item: SentimentPoint) => item.aiModel === selectedModel)
      .map((item: SentimentPoint): ChartPointWithDate => ({
        date: new Date(item.date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric'
        }),
        score: item.sentimentScore,
        fullDate: item.date // Keep original date for sorting
      }))
      .sort((a: ChartPointWithDate, b: ChartPointWithDate) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime())
      .map(({ fullDate: _fullDate, ...rest }) => rest); // Remove fullDate from final data

    return filteredData;
  }, [data?.sentimentOverTime, selectedModel]);

  // Calculate X-axis interval to prevent clipping
  const xAxisInterval = useMemo(() => {
    if (!chartData || chartData.length === 0) return 0;
    
    let interval = 0;
    if (chartData.length > 15) {
      interval = Math.ceil(chartData.length / 8); // Show ~8 labels max
    } else if (chartData.length > 10) {
      interval = Math.ceil(chartData.length / 6); // Show ~6 labels
    }
    
    return interval;
  }, [chartData]);

  // Get model display name with special case for 'all'
  const getDisplayName = (model: string): string => {
    if (model === 'all') return 'All Models';
    return getModelDisplayName(model);
  };

  const renderContent = () => {
    if (!chartData || chartData.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-400 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 12l3-3 3 3 4-4" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm font-medium">No historical data available</p>
            <p className="text-gray-400 text-xs mt-1">Run more reports to see trends</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 w-full" style={{ minHeight: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={chartData} 
            margin={{ 
              top: 20, 
              right: 30, 
              bottom: chartData.length > 10 ? 35 : 15, // More bottom margin for rotated labels
              left: 20 
            }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#e2e8f0" 
              strokeWidth={1}
            />
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ 
                fontSize: 12, 
                fill: '#64748b',
                textAnchor: chartData.length > 10 ? 'end' : 'middle' // Anchor for rotation
              }}
              tickMargin={chartData.length > 10 ? 8 : 5}
              interval={xAxisInterval}
              angle={chartData.length > 10 ? -45 : 0} // Rotate labels if many points
              height={chartData.length > 10 ? 60 : 40}
            />
            <YAxis 
              domain={[0, 10]}
              ticks={[2, 4, 6, 8, 10]}
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
              formatter={(value: number) => [
                `${value.toFixed(1)}/10`,
                'Average Score'
              ]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#2563eb"
              strokeWidth={chartData.length > 1 ? 3 : 0}
              dot={{ 
                fill: '#2563eb', 
                strokeWidth: 2, 
                r: 5,
                stroke: '#ffffff'
              }}
              activeDot={{ 
                r: 7, 
                stroke: '#2563eb',
                strokeWidth: 2,
                fill: '#ffffff'
              }}
            />
            {chartData.length === 1 && <Scatter dataKey="score" fill="#2563eb" />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <Card className="h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Sentiment Over Time</h3>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          {getDisplayName(selectedModel)}
        </span>
      </div>
      {renderContent()}
    </Card>
  );
};

export default SentimentOverTimeCard;  