import { useState, useEffect, useMemo } from 'react';
import { Loader, Calendar, RefreshCw, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { useCompany } from '../contexts/CompanyContext';
import { useDashboard } from '../hooks/useDashboard';
import { triggerReportGeneration, getReportStatus } from '../services/reportService';
import { generateCompetitors } from '../services/companyService';
import WelcomePrompt from '../components/ui/WelcomePrompt';
import Card from '../components/ui/Card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { MODEL_CONFIGS, getModelDisplayName } from '../types/dashboard';
import FilterDropdown from '../components/dashboard/FilterDropdown';

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
  averagePosition: number | null;
  inclusionRate: number | null;
}

const SUMMARY_ENGINE_ID = 'serplexity-summary'; // aggregated value we want to exclude

/*******************************************************************************
 *  Helper utilities
 ******************************************************************************/
const pickLatestMetricValue = <T,>(metrics: any[], name: string): T | null => {
  const candidates = metrics
    .filter((m) => m.name === name)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (candidates.length === 0) return null;
  return candidates[0].value as T;
};

/*******************************************************************************
 *  Visualization Components
 ******************************************************************************/
const ModelShareOfVoiceChart: React.FC<{ data: any; modelIds: string[] }> = ({ data, modelIds }) => {
  if (!data || data.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center">
        <p className="text-gray-500">No time-series data available.</p>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const sorted = [...payload].sort((a, b) => (b.value as number) - (a.value as number));

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow p-2 text-xs">
        <p className="font-semibold text-gray-800 mb-1">{label}</p>
        {sorted.map((entry) => (
          <div key={entry.dataKey} className="flex items-center gap-2" style={{ color: entry.stroke }}>
            <span className="truncate max-w-[100px]">{entry.name}</span>
            <span className="font-medium ml-auto">{(entry.value as number).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col relative">
      <div className="flex flex-col flex-1">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Share of Voice Over Time</h3>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, bottom: -15, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeWidth={1} horizontalPoints={[0]} />
              <XAxis
                dataKey="date"
                axisLine={{ stroke: '#e2e8f0', strokeWidth: 1 }}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickMargin={0}
              />
              <YAxis
                domain={[0, 100]}
                axisLine={{ stroke: '#e2e8f0', strokeWidth: 1 }}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#64748b' }}
                ticks={[0, 20, 40, 60, 80, 100]}
                tickFormatter={(val) => `${val}%`}
                width={20}
                interval={0}
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
                    strokeWidth: 2,
                    r: 4,
                    stroke: '#ffffff',
                  }}
                  activeDot={{ r: 6, stroke: modelColors[idx % modelColors.length], strokeWidth: 2, fill: '#ffffff' }}
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
      <div className="p-4 flex flex-col h-full">
        <h3 className="text-lg font-semibold text-gray-900 flex-shrink-0">Key Metrics Comparison</h3>
        <div className="mt-4 flex-1 overflow-auto">
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
                    {row.shareOfVoice !== null ? `${row.shareOfVoice.toFixed(1)}%` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700">
                    {row.averagePosition !== null ? row.averagePosition.toFixed(1) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700">
                    {row.inclusionRate !== null ? `${row.inclusionRate.toFixed(1)}%` : '—'}
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
    data,
    filters,
    loading,
    refreshing,
    updateFilters,
    refreshData,
    lastUpdated,
  } = useDashboard();

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortField>('shareOfVoice');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Determine if dashboard has data
  const hasExistingData = data && data.metrics && data.metrics.length > 0;

  // Polling for report generation status
  useEffect(() => {
    if (!isGenerating || !runId) return;

    const poll = setInterval(async () => {
      try {
        const status = await getReportStatus(runId);
        setGenerationStatus(status.stepStatus || 'Processing data...');
        if (status.status === 'COMPLETED' || status.status === 'FAILED') {
          setIsGenerating(false);
          setRunId(null);
          if (status.status === 'COMPLETED') await refreshData();
        }
      } catch (err) {
        console.error('Status polling failed:', err);
        setIsGenerating(false);
        setRunId(null);
      }
    }, 2500);

    return () => clearInterval(poll);
  }, [isGenerating, runId, refreshData]);

  /**
   * Kick-off report generation pipeline
   */
  const handleGenerateReport = async () => {
    if (!selectedCompany) return;

    setIsGenerating(true);
    setGenerationStatus('Initializing report generation pipeline...');

    try {
      // Ensure at least one competitor exists (same logic as other pages)
      const sampleCompetitor = selectedCompany.competitors[0]?.name;
      if (!sampleCompetitor) {
        setGenerationStatus('Error: add one competitor to seed the list.');
        setIsGenerating(false);
        return;
      }
      await generateCompetitors(selectedCompany.id, sampleCompetitor);

      const { runId: newRunId } = await triggerReportGeneration(selectedCompany.id);
      setRunId(newRunId);
    } catch (err) {
      console.error('Failed to start report generation:', err);
        setIsGenerating(false);
      setGenerationStatus('Failed to start report generation');
    }
  };

  /***************************************************************************
   *  Derive model-specific metrics & history (memoized)
   ***************************************************************************/
  const { metricRows, historyData, modelIds } = useMemo(() => {
    if (!hasExistingData) return { metricRows: [], historyData: [], modelIds: [] as string[] };

    // Group metrics by engine/model
    const metricsByModel: Record<string, any[]> = {};
    (data!.metrics as any[]).forEach((m) => {
      if (!m.engine || m.engine === SUMMARY_ENGINE_ID) return; // skip summary
      if (!metricsByModel[m.engine]) metricsByModel[m.engine] = [];
      metricsByModel[m.engine].push(m);
    });

    // Build summary rows
    const metricRows: ModelMetricRow[] = Object.keys(metricsByModel).map((modelId) => {
      const group = metricsByModel[modelId];
      const sov = pickLatestMetricValue<{ shareOfVoice: number }>(group, 'brandShareOfVoice');
      const pos = pickLatestMetricValue<{ averagePosition: number }>(group, 'averagePosition');
      const air = pickLatestMetricValue<{ averageInclusionRate: number }>(group, 'averageInclusionRate');
      return {
        modelId,
        displayName: getModelDisplayName(modelId),
        logoUrl: MODEL_CONFIGS[modelId]?.logoUrl,
        shareOfVoice: sov ? sov.shareOfVoice : null,
        averagePosition: pos ? pos.averagePosition : null,
        inclusionRate: air ? air.averageInclusionRate : null,
      };
    });

    // Build share-of-voice history per model
    const historyAccumulator: Record<string, any> = {};
    (data!.metrics as any[]).forEach((m) => {
      if (m.name !== 'shareOfVoiceHistory' || m.engine === SUMMARY_ENGINE_ID) return;
      if (!m.value || !m.value.history) return;
      m.value.history.forEach((pt: { date: string; shareOfVoice: number }) => {
        const dateKey = new Date(pt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (!historyAccumulator[dateKey]) historyAccumulator[dateKey] = { date: dateKey };
        historyAccumulator[dateKey][m.engine] = pt.shareOfVoice;
      });
    });

    const historyData = Object.values(historyAccumulator).sort(
      (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    return { metricRows, historyData, modelIds: Object.keys(metricsByModel) };
  }, [data, hasExistingData]);

  const dateRangeOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' },
  ];

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
  }, [metricRows, sortBy, sortDir]);

  /***************************************************************************
   *  Render
   ***************************************************************************/
  return (
    <div className="h-full flex flex-col">
      {!hasExistingData ? (
        <WelcomePrompt
          onGenerateReport={handleGenerateReport}
          isGenerating={isGenerating}
          generationStatus={generationStatus}
        />
      ) : (
        <>
          <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Model Comparison</h1>
              {lastUpdated && (
                <p className="text-sm text-gray-500 mt-1">
                  Last updated: {new Date(lastUpdated).toLocaleString()}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 lg:flex items-center gap-2 w-full lg:w-auto">
              <FilterDropdown
                label="Date Range"
                value={filters.dateRange}
                options={dateRangeOptions}
                onChange={(value) => updateFilters({ dateRange: value as '7d' | '30d' | '90d' | '1y' })}
                icon={Calendar}
                disabled={loading || refreshing}
              />
              <button
                onClick={refreshData}
                disabled={loading || refreshing}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[#7762ff] text-white rounded-lg hover:bg-[#6650e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium col-span-2"
              >
                {refreshing ? (
                  <><Loader size={16} className="animate-spin" /><span>Refreshing...</span></>
                ) : (
                  <><RefreshCw size={16} /><span>Refresh data</span></>
                )}
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 p-1 flex flex-col gap-4">
            <div className="h-[350px] flex-shrink-0">
              <ModelShareOfVoiceChart data={historyData} modelIds={modelIds} />
            </div>
            <div className="flex-1 min-h-0">
              <ModelMetricsTable rows={sortedRows} handleSort={handleSort} sortBy={sortBy} sortDir={sortDir} />
          </div>
        </div>
        </>
      )}
    </div>
  );
};

export default ModelComparisonPage; 