import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../ui/Card';
import { useDashboard } from '../../hooks/useDashboard';

interface VisibilityOverTimeCardProps {
  selectedModel?: string;
}

interface ChartDataPoint {
  date: string;
  shareOfVoice: number;
}

interface ShareOfVoiceHistoryItem {
  date: string;
  aiModel: string;
  shareOfVoice: number;
}

const VisibilityOverTimeCard: React.FC<VisibilityOverTimeCardProps> = ({ selectedModel = 'all' }) => {
  const { data, loading, error, filters } = useDashboard();
  
  // Filter data by selected model and format for chart
  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!data?.shareOfVoiceHistory || !Array.isArray(data.shareOfVoiceHistory)) {
      return [];
    }

    // When selectedModel is 'all', look for 'all' data (not 'serplexity-summary')
    const targetModel = selectedModel === 'all' ? 'all' : selectedModel;
    
    // Filter by target model
    let filteredData = (data.shareOfVoiceHistory as ShareOfVoiceHistoryItem[])
      .filter(item => item.aiModel === targetModel);

    // If no data for target model, fall back to other options
    if (filteredData.length === 0) {
      // If still no data, take the first available model
      if (data.shareOfVoiceHistory.length > 0) {
        const firstModel = (data.shareOfVoiceHistory[0] as ShareOfVoiceHistoryItem).aiModel;
        filteredData = (data.shareOfVoiceHistory as ShareOfVoiceHistoryItem[])
          .filter(item => item.aiModel === firstModel);
      }
    }

    // Apply date range filter based on dashboard filters
    const now = new Date();
    const dateFilter = filters?.dateRange || '30d';
    const cutoffDate = new Date(now);
    
    switch (dateFilter) {
      case '7d':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        cutoffDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Filter by date range
    filteredData = filteredData.filter(item => new Date(item.date) >= cutoffDate);

    // Group by date to ensure unique dates (in case there are duplicates)
    const dateMap = new Map<string, ShareOfVoiceHistoryItem>();
    filteredData.forEach(item => {
      const dateKey = new Date(item.date).toISOString().split('T')[0]; // Use YYYY-MM-DD as key
      if (!dateMap.has(dateKey) || new Date(item.date) > new Date(dateMap.get(dateKey)!.date)) {
        dateMap.set(dateKey, item);
      }
    });

    const uniqueFilteredData = Array.from(dateMap.values());

    const processedData = uniqueFilteredData
      .map(item => {
        const date = new Date(item.date);
        // Ensure the date is valid
        if (isNaN(date.getTime())) {
          console.warn('Invalid date:', item.date);
          return null;
        }
        return {
          date: date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          shareOfVoice: item.shareOfVoice,
          fullDate: item.date // Keep original date for sorting
        };
      })
      .filter(item => item !== null) // Remove invalid dates
      .sort((a, b) => new Date(a!.fullDate).getTime() - new Date(b!.fullDate).getTime())
      .map(({ fullDate: _fullDate, ...rest }) => rest); // Remove fullDate from final data

    return processedData as ChartDataPoint[];
  }, [data?.shareOfVoiceHistory, selectedModel, filters?.dateRange]);

  const { yAxisMax, ticks, xAxisInterval } = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { yAxisMax: 100, ticks: [0, 20, 40, 60, 80, 100], xAxisInterval: 0 };
    }
    
    const maxVal = Math.max(...chartData.map((d: ChartDataPoint) => d.shareOfVoice));

    if (maxVal === 0) {
      return { yAxisMax: 10, ticks: [0, 5, 10], xAxisInterval: 0 };
    }

    const dynamicMax = Math.min(100, maxVal * 1.4);
    
    let increment;
    if (dynamicMax <= 20) {
      increment = 5;
    } else if (dynamicMax <= 50) {
      increment = 10;
    } else {
      increment = 20;
    }

    const finalMax = Math.ceil(dynamicMax / increment) * increment;

    const tickValues = [];
    for (let i = 0; i <= finalMax; i += increment) {
      tickValues.push(i);
    }
    
    // Calculate X-axis interval to prevent clipping
    let interval = 0;
    if (chartData.length > 15) {
      interval = Math.ceil(chartData.length / 8); // Show ~8 labels max
    } else if (chartData.length > 10) {
      interval = Math.ceil(chartData.length / 6); // Show ~6 labels
    }
    
    return { yAxisMax: finalMax, ticks: tickValues, xAxisInterval: interval };
  }, [chartData]);

  const getModelDisplayName = (model: string): string => {
    if (model === 'all') return 'All Models';
    const modelMap: Record<string, string> = {
      'gpt-4.1-mini': 'GPT-4o Mini',
      'claude-3.5-haiku-20241022': 'Claude 3.5 Haiku',
      'gemini-2.5-flash': 'Gemini 2.5 Flash',
      'sonar': 'Perplexity Sonar'
    };
    return modelMap[model] || model;
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-red-500 text-sm">{error}</p>
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
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={chartData} 
            margin={{ 
              top: 5, 
              right: 15, 
              bottom: 0, // Further reduced bottom margin
              left: 20 
            }}
          >
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
              tick={{ 
                fontSize: 11, 
                fill: '#64748b',
                textAnchor: chartData.length > 10 ? 'end' : 'middle' // Anchor for rotation
              }}
              tickMargin={chartData.length > 10 ? 2 : 0} // Further reduced tick margin
              interval={xAxisInterval}
              angle={chartData.length > 10 ? -45 : 0} // Rotate labels if many points
              height={chartData.length > 10 ? 25 : 20} // Further reduced height
            />
            <YAxis 
              domain={[0, yAxisMax]}
              ticks={ticks}
              allowDecimals={false}
              axisLine={{ stroke: '#e2e8f0', strokeWidth: 1 }}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickFormatter={(value) => (value === 0 ? '' : `${value}%`)}
              width={20}
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
                `${value.toFixed(1)}%`,
                'Share of Voice'
              ]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="shareOfVoice"
              stroke="#7762ff"
              strokeWidth={chartData.length > 1 ? 2 : 0}
              dot={{ 
                fill: '#7762ff', 
                strokeWidth: chartData.length === 1 ? 2 : 0,
                stroke: chartData.length === 1 ? '#ffffff' : '#7762ff',
                r: chartData.length === 1 ? 6 : 4,
              }}
              activeDot={{ 
                r: 8, 
                fill: '#7762ff',
                strokeWidth: 2,
                stroke: '#ffffff',
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <Card className="h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Visibility Over Time</h3>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          {getModelDisplayName(selectedModel)}
        </span>
      </div>
      {renderContent()}
    </Card>
  );
};

export default VisibilityOverTimeCard; 