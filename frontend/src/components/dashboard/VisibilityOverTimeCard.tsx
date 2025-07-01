import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Scatter } from 'recharts';
import Card from '../ui/Card';
import { useDashboard } from '../../hooks/useDashboard';

const VisibilityOverTimeCard = () => {
  const { data, loading, error } = useDashboard();
  const chartData = useMemo(() => data?.shareOfVoiceHistory || [], [data?.shareOfVoiceHistory]);

  const { yAxisMax, ticks } = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { yAxisMax: 100, ticks: [0, 20, 40, 60, 80, 100] };
    }
    const maxVal = Math.max(...chartData.map(d => d.shareOfVoice));

    if (maxVal === 0) {
      return { yAxisMax: 10, ticks: [0, 5, 10] };
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
    
    return { yAxisMax: finalMax, ticks: tickValues };
  }, [chartData]);

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
          <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: -15, left: 20 }}>
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
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickMargin={0}
            />
            <YAxis 
              domain={[0, yAxisMax]}
              ticks={ticks}
              allowDecimals={false}
              axisLine={{ stroke: '#e2e8f0', strokeWidth: 1 }}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickFormatter={(value) => `${value}%`}
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
                strokeWidth: 0, 
                r: 4,
              }}
              activeDot={{ 
                r: 6, 
                fill: '#7762ff',
                strokeWidth: 0,
              }}
            />
            {chartData.length === 1 && <Scatter dataKey="shareOfVoice" fill="#7762ff" />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <Card className="h-full">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Visibility Over Time</h3>
      {renderContent()}
    </Card>
  );
};

export default VisibilityOverTimeCard; 