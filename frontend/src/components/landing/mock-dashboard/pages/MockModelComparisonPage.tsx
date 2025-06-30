import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, TooltipProps } from 'recharts';
import MockDashboardLayout from '../MockDashboardLayout';
import MockDashboardCard from '../cards/MockDashboardCard';
import { ChevronUp, ChevronDown, Calendar, ArrowUpDown, RefreshCw } from 'lucide-react';
import { getModelDisplayName, MODEL_CONFIGS } from '../../../../types/dashboard';
import MockFilterDropdown from '../MockFilterDropdown';

// Inline mock data reflecting the structure of ModelComparisonPage.tsx
const mockModelComparisonData = {
    historyData: [
        { date: 'Jun 1', 'gpt-4.1-mini': 5.0, 'claude-3-5-haiku-20241022': 4.0, 'gemini-2.5-flash': 6.0, 'sonar': 1.0 },
        { date: 'Jun 8', 'gpt-4.1-mini': 10.0, 'claude-3-5-haiku-20241022': 8.0, 'gemini-2.5-flash': 12.0, 'sonar': 3.0 },
        { date: 'Jun 15', 'gpt-4.1-mini': 25.0, 'claude-3-5-haiku-20241022': 20.0, 'gemini-2.5-flash': 22.0, 'sonar': 10.0 },
        { date: 'Jun 22', 'gpt-4.1-mini': 40.0, 'claude-3-5-haiku-20241022': 35.0, 'gemini-2.5-flash': 35.0, 'sonar': 18.0 },
        { date: 'Jun 28', 'gpt-4.1-mini': 49.5, 'claude-3-5-haiku-20241022': 42.0, 'gemini-2.5-flash': 40.0, 'sonar': 22.5 },
    ],
    metricRows: [
        { modelId: 'gpt-4.1-mini', shareOfVoice: 49.5, shareOfVoiceChange: 44.5, averagePosition: 1.8, averagePositionChange: -0.5, inclusionRate: 92.1, inclusionRateChange: 10.0 },
        { modelId: 'claude-3-5-haiku-20241022', shareOfVoice: 42.0, shareOfVoiceChange: 38.0, averagePosition: 2.1, averagePositionChange: -0.4, inclusionRate: 85.3, inclusionRateChange: 8.0 },
        { modelId: 'gemini-2.5-flash', shareOfVoice: 40.0, shareOfVoiceChange: 34.0, averagePosition: 2.5, averagePositionChange: 0.1, inclusionRate: 80.0, inclusionRateChange: 5.0 },
        { modelId: 'sonar', shareOfVoice: 22.5, shareOfVoiceChange: 21.5, averagePosition: 4.0, averagePositionChange: -1.0, inclusionRate: 65.0, inclusionRateChange: 20.0 },
    ]
};

const dateRangeOptions = [
  { value: '30d', label: 'Last 30 days' },
  { value: '7d', label: 'Last 7 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' },
];

const modelColors = ['#7762ff', '#6650e6', '#927fff', '#5b4ac8', '#a99aff', '#4b39b0'];

const getChangeDisplay = (change: number | null) => {
    if (change === null || Math.abs(change) < 0.1) return <div className="flex items-center justify-center text-xs ml-2 text-gray-400 w-12"><span>—</span></div>;
    const isPositive = change > 0;
    return (
        <div className={`flex items-center text-xs ml-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            <span className="ml-1">{Math.abs(change).toFixed(1)}%</span>
        </div>
    );
};

const CustomTooltip: React.FC<TooltipProps<number, string>> = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    const sorted = [...payload].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs z-50">
        <p className="font-semibold text-gray-800 mb-1">{label}</p>
        {sorted.map((entry) => (
          <div key={entry.dataKey} className="flex items-center gap-2" style={{ color: entry.color }}>
            <span className="truncate max-w-[120px]">{entry.name}</span>
            <span className="font-bold ml-auto">{entry.value?.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    );
};

type SortField = 'model' | 'shareOfVoice' | 'averagePosition' | 'inclusionRate';

const MockModelComparisonPage: React.FC = () => {
    const { historyData, metricRows } = mockModelComparisonData;
    const modelIds = metricRows.map((r) => r.modelId);
    
    const [sortBy, setSortBy] = useState<SortField>('shareOfVoice');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const handleSort = (field: SortField) => {
      if (sortBy === field) {
        setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
      } else {
        setSortBy(field);
        setSortDir(field === 'model' ? 'asc' : 'desc');
      }
    };

    const sortedRows = useMemo(() => {
      const copy = [...metricRows];
      copy.sort((a, b) => {
        let aVal: number | string | null = 0;
        let bVal: number | string | null = 0;
        switch (sortBy) {
          case 'model':
            aVal = getModelDisplayName(a.modelId).toLowerCase();
            bVal = getModelDisplayName(b.modelId).toLowerCase();
            break;
          case 'shareOfVoice':
            aVal = a.shareOfVoice ?? -Infinity;
            bVal = b.shareOfVoice ?? -Infinity;
            break;
          case 'averagePosition':
            aVal = a.averagePosition ?? Infinity;
            bVal = b.averagePosition ?? Infinity;
            break;
          case 'inclusionRate':
            aVal = a.inclusionRate ?? -Infinity;
            bVal = b.inclusionRate ?? -Infinity;
            break;
        }
  
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        const numA = Number(aVal);
        const numB = Number(bVal);
        return sortDir === 'asc' ? numA - numB : numB - numA;
      });
      return copy;
    }, [metricRows, sortBy, sortDir]);

    const renderSortableHeader = (field: SortField, label: string) => (
      <th
        className="px-3 py-3 text-left text-sm font-semibold text-gray-900 cursor-pointer select-none"
        onClick={() => handleSort(field)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {sortBy === field ? (
            sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
          ) : (
            <ArrowUpDown size={14} className="text-gray-400" />
          )}
        </span>
      </th>
    );

  return (
    <MockDashboardLayout activePage="Model Comparison">
        <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Model Comparison</h1>
              <p className="text-sm text-gray-500 mt-1">
                Last updated: 6/28/2025, 5:05:00 AM
              </p>
            </div>
            <div className="flex items-center gap-2">
                <MockFilterDropdown
                    label="Date Range"
                    value={'30d'}
                    options={dateRangeOptions}
                    icon={Calendar}
                />
                <button 
                    disabled
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-[#7762ff] text-white rounded-lg hover:bg-[#6650e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                    <RefreshCw size={16} />
                    <span className="whitespace-nowrap">Refresh data</span>
                </button>
            </div>
        </div>
      <div className="flex-1 min-h-0 flex flex-col gap-4">
        <MockDashboardCard className="h-[350px] flex-shrink-0 !p-0 relative">
            <div className="flex flex-col flex-1 h-full p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Visibility Over Time</h3>
                <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={historyData} margin={{ top: 5, right: 5, bottom: -15, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeWidth={1} horizontalPoints={[0]} />
                        <XAxis dataKey="date" axisLine={{ stroke: '#e2e8f0', strokeWidth: 1 }} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickMargin={0}/>
                        <YAxis domain={[0, 100]} axisLine={{ stroke: '#e2e8f0', strokeWidth: 1 }} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} ticks={[0, 20, 40, 60, 80, 100]} tickFormatter={(val) => `${val}%`} width={20} interval={0}/>
                        <Tooltip content={<CustomTooltip />} wrapperStyle={{ outline: 'none' }} />
                        {modelIds.map((modelId, idx) => (
                            <Line key={modelId} type="monotone" dataKey={modelId} name={getModelDisplayName(modelId)} stroke={modelColors[idx % modelColors.length]} strokeWidth={2} dot={{ fill: modelColors[idx % modelColors.length], strokeWidth: 2, r: 4, stroke: '#ffffff' }} activeDot={{ r: 6 }}/>
                        ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="absolute top-4 right-4 bg-white/60 backdrop-blur-md border border-gray-200/50 rounded-lg shadow p-2 space-y-1 text-xs pointer-events-none">
                {modelIds.map((modelId: string, idx: number) => (
                <div key={`legend-${modelId}`} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: modelColors[idx % modelColors.length] }}></span>
                    <span className="text-gray-800 truncate max-w-[120px]">{getModelDisplayName(modelId)}</span>
                </div>
                ))}
            </div>
        </MockDashboardCard>
        <MockDashboardCard className="flex-1 min-h-0 !p-0">
            <div className="p-4 flex flex-col h-full overflow-hidden">
                <h3 className="text-lg font-semibold text-gray-900 flex-shrink-0">Key Metrics Comparison</h3>
                <div className="mt-4 flex-1 min-h-0 overflow-auto">
                    <table className="min-w-full divide-y divide-gray-300">
                        <thead>
                        <tr>
                            {renderSortableHeader('model', 'Model')}
                            {renderSortableHeader('shareOfVoice', 'Share of Voice')}
                            {renderSortableHeader('averagePosition', 'Avg. Position')}
                            {renderSortableHeader('inclusionRate', 'Inclusion Rate')}
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                        {sortedRows.map((row) => (
                            <tr key={row.modelId} className="bg-white">
                                <td className="whitespace-nowrap py-4 pr-3 text-sm">
                                    <div className="flex items-center gap-3">
                                        <img src={MODEL_CONFIGS[row.modelId]?.logoUrl} alt={getModelDisplayName(row.modelId)} className="h-6 w-6 rounded-full object-contain bg-white" />
                                        <span className="font-medium text-gray-900">{getModelDisplayName(row.modelId)}</span>
                                    </div>
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700"><div className="flex items-center"><span>{row.shareOfVoice !== null ? `${row.shareOfVoice.toFixed(1)}%` : '—'}</span>{getChangeDisplay(row.shareOfVoiceChange)}</div></td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700"><div className="flex items-center"><span>{row.averagePosition !== null ? row.averagePosition.toFixed(1) : '—'}</span>{getChangeDisplay(row.averagePositionChange)}</div></td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700"><div className="flex items-center"><span>{row.inclusionRate !== null ? `${row.inclusionRate.toFixed(1)}%` : '—'}</span>{getChangeDisplay(row.inclusionRateChange)}</div></td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </MockDashboardCard>
      </div>
    </MockDashboardLayout>
  );
};

export default MockModelComparisonPage;