/**
 * @file BrandShareOfVoiceCard.tsx
 * @description This component displays the brand's share of voice using a pie chart.
 * It fetches the share of voice data from the `useDashboard` hook and visualizes it,
 * showing the percentage of mentions for the selected company versus others. It handles
 * loading, error, and no-data states, and provides a clear visual representation of brand visibility.
 *
 * @dependencies
 * - recharts: A customizable charting library for React.
 * - ../ui/Card: Generic card component for consistent UI.
 * - ../../contexts/CompanyContext: Provides access to the selected company's information.
 * - ../../contexts/DashboardContext: Provides access to dashboard data.
 *
 * @exports
 * - BrandShareOfVoiceCard: React functional component for displaying brand share of voice.
 */
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import Card from '../ui/Card';
import { useCompany } from '../../contexts/CompanyContext';
import { useDashboard } from '../../contexts/DashboardContext';

const COLORS = ['#7762ff', '#e5e7eb']; // primary purple, gray-200

const BrandShareOfVoiceCard = () => {
  const { selectedCompany } = useCompany();
  const { data, loading, error } = useDashboard();

  const shareOfVoice = data?.shareOfVoice || 0;
  const hasData = !loading && !error && data?.shareOfVoice !== undefined && data.shareOfVoice !== null;

  const chartData = [
    { name: 'Your Company', value: shareOfVoice },
    { name: 'Others', value: Math.max(0, 100 - shareOfVoice) },
  ];

  if (loading) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Share of Voice</h3>
        <div className="flex items-center justify-center h-24">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Share of Voice</h3>
        <div className="flex items-center justify-center h-24">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      </Card>
    );
  }

  if (!hasData) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Share of Voice</h3>
        <div className="flex items-center justify-center h-24">
          <p className="text-gray-400 text-sm">No data available</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">Share of Voice</h3>
      <div className="flex-1 flex items-start justify-center pt-2">
        <div className="flex items-center gap-4">
          <div className="w-32 h-32 flex items-center justify-center">
            <ResponsiveContainer width={128} height={142}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx={64}
                  cy={64}
                  innerRadius={35}
                  outerRadius={58}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  style={{ outline: 'none' }}
                >
                  {chartData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value: number, name: string) => {
                    const displayName = name === 'Your Company' ? (selectedCompany?.name || 'Your Company') : 'Others';
                    return [
                      <span style={{ color: '#7762ff' }}>{displayName}: {value.toFixed(1)}%</span>,
                      <span style={{ fontWeight: '600' }}>Share</span>
                    ];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
                     <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#7762ff' }}></div>
              <span className="text-sm text-gray-600 truncate">{selectedCompany?.name || 'Your Company'}</span>
              <span className="text-sm font-semibold text-gray-800">{shareOfVoice.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-200 flex-shrink-0"></div>
              <span className="text-sm text-gray-600">Others</span>
              <span className="text-sm font-semibold text-gray-800">{(100 - shareOfVoice).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default BrandShareOfVoiceCard; 