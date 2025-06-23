import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Scatter } from 'recharts';
import Card from '../ui/Card';
import { useDashboard } from '../../hooks/useDashboard';
import { getModelDisplayName } from '../../types/dashboard';

interface SentimentOverTimeCardProps {
  selectedModel?: string;
}

const SentimentOverTimeCard: React.FC<SentimentOverTimeCardProps> = ({ selectedModel = 'all' }) => {
  const { data, loading } = useDashboard();

  // The complex useMemo hook is no longer needed!
  // Data is now pre-calculated on the backend.
  const chartData = data?.sentimentOverTime || [];

  // Get model display name with special case for 'all'
  const getDisplayName = (model: string) => {
    if (model === 'all') return 'All Models';
    return getModelDisplayName(model);
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      );
    }

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
            margin={{ top: 20, right: 30, bottom: 15, left: 20 }}
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
              formatter={(value: number) => [
                `${value.toFixed(1)}/10`,
                'Average Score'
              ]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#7762ff"
              strokeWidth={chartData.length > 1 ? 3 : 0}
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
            {chartData.length === 1 && <Scatter dataKey="score" fill="#7762ff" />}
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