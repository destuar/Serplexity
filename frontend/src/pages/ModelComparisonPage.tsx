/**
 * @file ModelComparisonPage.tsx
 * @description Model comparison page for analyzing AI model performance and differences.
 * Provides model comparison tools, performance metrics, and analysis insights.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - react-router-dom: For navigation.
 * - lucide-react: For icons.
 * - ../hooks/useModelComparison: For model comparison data.
 *
 * @exports
 * - ModelComparisonPage: The main model comparison page component.
 */
import { useState, useMemo } from 'react';
import { Loader, Calendar, RefreshCw, ArrowUpDown, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';
import { useCompany } from '../contexts/CompanyContext';
import { useDashboard } from '../hooks/useDashboard';
import { useModelComparison } from '../hooks/useModelComparison';
import WelcomePrompt from '../components/ui/WelcomePrompt';
import BlankLoadingState from '../components/ui/BlankLoadingState';
import Card from '../components/ui/Card';
import MultiSelectDropdown from '../components/ui/MultiSelectDropdown';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import { MODEL_CONFIGS, getModelDisplayName } from '../types/dashboard';
import FilterDropdown from '../components/dashboard/FilterDropdown';
import { useReportGeneration } from '../hooks/useReportGeneration';

interface TimeSeriesDataPoint {
  date: string;
  [modelId: string]: number | string;
}

// Colors for chart lines (cycled)
const modelColors = [
  '#7762ff', // brand primary
  '#6650e6', // darker
  '#927fff', // lighter
  '#5b4ac8', // deeper
  '#a99aff', // very light
  '#4b39b0', // deep
  '#c1b7ff', // pale
  '#3e2e97', // darkest
];

interface ModelMetricRow {
  modelId: string;
  displayName: string;
  logoUrl?: string;
  shareOfVoice: number | null;
  shareOfVoiceChange: number | null;
  averagePosition: number | null;
  averagePositionChange: number | null;
  inclusionRate: number | null;
  inclusionRateChange: number | null;
}

/*******************************************************************************
 *  Helper utilities
 ******************************************************************************/
const getChangeDisplay = (change: number | null) => {
  if (change === null) return null;
  
  // Show gray dash for 0% change (centered to match "0.0%" width)
  if (Math.abs(change) < 0.1) {
    return (
      <div className="flex items-center justify-center text-xs ml-2 text-gray-400 w-12">
        <span>—</span>
      </div>
    );
  }
  
  const isPositive = change > 0;
  return (
    <div className={`flex items-center text-xs ml-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
      {isPositive ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      <span className="ml-1">{Math.abs(change).toFixed(1)}%</span>
    </div>
  );
};

/*******************************************************************************
 *  Visualization Components
 ******************************************************************************/
const ModelShareOfVoiceChart: React.FC<{ data: TimeSeriesDataPoint[]; modelIds: string[] }> = ({ data, modelIds }) => {
  const { yAxisMax, ticks } = useMemo(() => {
    if (!data || data.length === 0) {
      return { yAxisMax: 100, ticks: [0, 20, 40, 60, 80, 100] };
    }
    const allValues = data.flatMap(d => modelIds.map(id => d[id] as number).filter(v => typeof v === 'number'));
    if (allValues.length === 0) {
      return { yAxisMax: 100, ticks: [0, 20, 40, 60, 80, 100] };
    }

    const maxVal = Math.max(...allValues);
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
    for (let i = increment; i <= finalMax; i += increment) {
      tickValues.push(i);
    }
    
    return { yAxisMax: finalMax, ticks: tickValues };
  }, [data, modelIds]);

  // Calculate X-axis interval to prevent clipping
  const xAxisInterval = useMemo(() => {
    if (!data || data.length === 0) return 0;
    
    let interval = 0;
    if (data.length > 15) {
      interval = Math.ceil(data.length / 8); // Show ~8 labels max
    } else if (data.length > 10) {
      interval = Math.ceil(data.length / 6); // Show ~6 labels
    }
    
    return interval;
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center">
        <p className="text-gray-500">No time-series data available.</p>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) return null;

    const sorted = [...payload].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow p-2 text-xs">
        <p className="font-semibold text-gray-800 mb-1">{label}</p>
        {sorted.map((entry) => (
          <div key={entry.dataKey} className="flex items-center gap-2" style={{ color: entry.stroke }}>
            <span className="truncate max-w-[100px]">{entry.name}</span>
            <span className="font-medium ml-auto">{entry.value?.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col relative">
      <div className="flex flex-col flex-1">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Visibility Over Time</h3>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={data} 
              margin={{ 
                top: 5, 
                right: 15, // Increased right margin to prevent clipping
                bottom: data.length > 10 ? 15 : 5, // Reduced bottom margin
                left: 20 
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeWidth={1} horizontalPoints={[0]} />
              <XAxis
                dataKey="date"
                axisLine={{ stroke: '#e2e8f0', strokeWidth: 1 }}
                tickLine={false}
                tick={{ 
                  fontSize: 11, 
                  fill: '#64748b',
                  textAnchor: data.length > 10 ? 'end' : 'middle' // Anchor for rotation
                }}
                tickMargin={data.length > 10 ? 8 : 0}
                interval={xAxisInterval}
                angle={data.length > 10 ? -45 : 0} // Rotate labels if many points
                height={data.length > 10 ? 50 : 30}
              />
              <YAxis
                domain={[0, yAxisMax]}
                ticks={ticks}
                allowDecimals={false}
                axisLine={{ stroke: '#e2e8f0', strokeWidth: 1 }}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(val) => `${val}%`}
                width={20}
              />
              <Tooltip content={<CustomTooltip />} wrapperStyle={{ outline: 'none' }} />
              {modelIds.map((modelId, idx) => (
                <Line
                  key={modelId}
                  type="monotone"
                  dataKey={modelId}
                  name={getModelDisplayName(modelId)}
                  stroke={modelColors[idx % modelColors.length]}
                  strokeWidth={data.length > 1 ? 2 : 0}
                  dot={{
                    fill: modelColors[idx % modelColors.length],
                    strokeWidth: 0,
                    r: 4,
                  }}
                  activeDot={{ r: 6, fill: modelColors[idx % modelColors.length], strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="absolute top-4 right-4 bg-white/60 backdrop-blur-md border border-gray-200/50 rounded-lg shadow p-2 space-y-1 text-xs" style={{ pointerEvents: 'none' }}>
        {modelIds.map((modelId, idx) => (
          <div key={`legend-${modelId}`} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: modelColors[idx % modelColors.length] }}></span>
            <span className="text-gray-800 truncate max-w-[120px]" style={{ color: '#1f2937' }}>
              {getModelDisplayName(modelId)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
};

type SortField = 'model' | 'shareOfVoice' | 'averagePosition' | 'inclusionRate';

const ModelMetricsTable: React.FC<{
  rows: ModelMetricRow[];
  handleSort: (field: SortField) => void;
  sortBy: SortField;
  sortDir: 'asc' | 'desc';
}> = ({ rows, handleSort, sortBy, sortDir }) => {
  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let aVal: number | string | null = 0;
      let bVal: number | string | null = 0;
      switch (sortBy) {
        case 'model':
          aVal = a.displayName.toLowerCase();
          bVal = b.displayName.toLowerCase();
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
  }, [rows, sortBy, sortDir]);

  if (rows.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center">
        <p className="text-gray-500">No summary metrics available.</p>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <div className="px-4 pb-4 pt-0 flex flex-col h-full">
        <div className="flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-gray-300">
            <thead>
              <tr>
                {([
                  { field: 'model', label: 'Model' },
                  { field: 'shareOfVoice', label: 'Share of Voice' },
                  { field: 'averagePosition', label: 'Avg. Position' },
                  { field: 'inclusionRate', label: 'Inclusion Rate' },
                ] as { field: SortField; label: string }[]).map(({ field, label }) => (
                  <th
                    key={field}
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
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedRows.map((row) => (
                <tr key={row.modelId} className="bg-white">
                  <td className="whitespace-nowrap py-4 pr-3 text-sm">
                    <div className="flex items-center gap-2">
                      {row.logoUrl && (
                        <img src={row.logoUrl} alt={row.displayName} className="h-6 w-6 rounded-full object-contain" />
                      )}
                      <span className="font-medium text-gray-900">{row.displayName}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700">
                    <div className="flex items-center">
                      <span>{row.shareOfVoice !== null ? `${row.shareOfVoice.toFixed(1)}%` : '—'}</span>
                      {getChangeDisplay(row.shareOfVoiceChange)}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700">
                    <div className="flex items-center">
                      <span>{row.averagePosition !== null ? row.averagePosition.toFixed(1) : '—'}</span>
                      {getChangeDisplay(row.averagePositionChange)}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700">
                    <div className="flex items-center">
                      <span>{row.inclusionRate !== null ? `${row.inclusionRate.toFixed(1)}%` : '—'}</span>
                      {getChangeDisplay(row.inclusionRateChange)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
};

/*******************************************************************************
 *  Main Page Component
 ******************************************************************************/
const ModelComparisonPage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const {
    filters,
    loading: dashboardLoading,
    refreshing,
    updateFilters,
    refreshData: refreshDashboard,
    lastUpdated,
    hasReport,
  } = useDashboard();

  const { 
    isGenerating, 
    generationStatus, 
    progress, 
    generateReport, 
    isButtonDisabled, 
    generationState, 
     
  } = useReportGeneration(selectedCompany);
  const { data: comparisonData, loading: comparisonLoading, refreshData: refreshComparison } = useModelComparison();
  
  const [sortBy, setSortBy] = useState<SortField>('shareOfVoice');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  
  // Local state for selected models (independent of global dashboard filters)
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Initialize selected models when comparison data is first loaded (only once)
  useMemo(() => {
    if (comparisonData && comparisonData.length > 0 && !hasInitialized) {
      const availableModels = comparisonData.map(d => d.aiModel!).filter(id => id !== 'all');
      setSelectedModels(availableModels);
      setHasInitialized(true);
    }
  }, [comparisonData, hasInitialized]);

  /***************************************************************************
   *  Derive model-specific metrics & history (memoized)
   ***************************************************************************/
  const { metricRows, historyData, modelIds } = useMemo(() => {
    if (!comparisonData || comparisonData.length === 0) {
      return { metricRows: [], historyData: [], modelIds: [] };
    }

    // Filter comparison data to only include selected models
    const filteredComparisonData = comparisonData.filter(modelData => 
      selectedModels.length > 0 && selectedModels.includes(modelData.aiModel!)
    );

    const rows: ModelMetricRow[] = filteredComparisonData.map(modelData => ({
      modelId: modelData.aiModel!,
      displayName: getModelDisplayName(modelData.aiModel!),
      logoUrl: MODEL_CONFIGS[modelData.aiModel!]?.logoUrl,
      shareOfVoice: modelData.shareOfVoice,
      shareOfVoiceChange: modelData.shareOfVoiceChange,
      averagePosition: modelData.averagePosition,
      averagePositionChange: modelData.averagePositionChange,
      inclusionRate: modelData.averageInclusionRate,
      inclusionRateChange: modelData.averageInclusionChange,
    }));

    // Build history data from the global shareOfVoiceHistory
    // The data structure should be: [{ date: "Jan 15", "gpt-4.1-mini": 7.5, "claude-3-5-haiku": 6.2, ... }]
    const historyAccumulator: Record<string, TimeSeriesDataPoint> = {};
    
    // Merge shareOfVoiceHistory from filtered models (exclude the aggregated 'all')
    filteredComparisonData.forEach(model => {
      (model.shareOfVoiceHistory || []).forEach((pt: { date: string; shareOfVoice: number; aiModel: string; }) => {
        if (pt.aiModel !== 'all' && selectedModels.length > 0 && selectedModels.includes(pt.aiModel)) {
          const dateKey = new Date(pt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          if (!historyAccumulator[dateKey]) {
            historyAccumulator[dateKey] = { date: dateKey } as TimeSeriesDataPoint;
          }
          historyAccumulator[dateKey][pt.aiModel] = pt.shareOfVoice;
        }
      });
    });

    const history = Object.values(historyAccumulator).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const ids = filteredComparisonData.map(d => d.aiModel!).filter(id => id !== 'all');

    return { metricRows: rows, historyData: history, modelIds: ids };
  }, [comparisonData, selectedModels]);

  const dateRangeOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' },
  ];

  const modelOptions = useMemo(() => {
    if (!comparisonData || comparisonData.length === 0) return [];
    
    const availableModels = comparisonData
      .map(d => d.aiModel!)
      .filter(id => id !== 'all')
      .map(modelId => ({
        value: modelId,
        label: getModelDisplayName(modelId),
        logoUrl: MODEL_CONFIGS[modelId]?.logoUrl,
      }));
    
    return availableModels;
  }, [comparisonData]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir(field === 'model' ? 'asc' : 'desc');
    }
  };

  const refreshData = async () => {
    await Promise.all([
      refreshDashboard(),
      refreshComparison(),
    ]);
  };

  const loading = dashboardLoading || comparisonLoading;

  /***************************************************************************
   *  Render
   ***************************************************************************/
  return (
    <div className="h-full flex flex-col">
      {dashboardLoading || hasReport === null ? (
        <BlankLoadingState message="Loading dashboard data..." />
      ) : hasReport === false ? (
        <WelcomePrompt
          onGenerateReport={generateReport}
          isGenerating={isGenerating}
          generationStatus={generationStatus}
          progress={progress}
          isButtonDisabled={isButtonDisabled}
          generationState={generationState}
        />
      ) : (
        <>
          {/* Header Section - Always show when there's a report */}
          <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Model Comparison</h1>
              {lastUpdated && (
                <p className="text-sm text-gray-500 mt-1">
                  Last updated: {new Date(lastUpdated).toLocaleString()}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex items-center gap-2 w-full lg:w-auto">
              <FilterDropdown
                label="Date Range"
                value={filters.dateRange}
                options={dateRangeOptions}
                onChange={(value) => updateFilters({ dateRange: value as '7d' | '30d' | '90d' | '1y' })}
                icon={Calendar}
                disabled={loading || refreshing}
              />
              <MultiSelectDropdown
                label="Models"
                selectedValues={selectedModels}
                options={modelOptions}
                onChange={setSelectedModels}
                icon={Sparkles}
                placeholder="Select models"
                disabled={loading || refreshing}
              />
              <button
                onClick={refreshData}
                disabled={loading || refreshing}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[#7762ff] text-white rounded-lg hover:bg-[#6650e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium col-span-2 sm:col-span-3"
              >
                {refreshing || loading ? (
                  <><Loader size={16} className="animate-spin" /><span>Refreshing...</span></>
                ) : (
                  <><RefreshCw size={16} /><span>Refresh Data</span></>
                )}
              </button>
            </div>
          </div>
          
          {/* Content Area - Show loading state only here */}
          {comparisonLoading || !comparisonData || comparisonData.length === 0 ? (
            <BlankLoadingState message="Processing model comparison data..." />
          ) : (
            <div className="flex-1 min-h-0 p-1 flex flex-col gap-4">
              <div className="h-[350px] flex-shrink-0">
                <ModelShareOfVoiceChart data={historyData} modelIds={modelIds} />
              </div>
              <div className="flex-1 min-h-0">
                <ModelMetricsTable rows={metricRows} handleSort={handleSort} sortBy={sortBy} sortDir={sortDir} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ModelComparisonPage; 