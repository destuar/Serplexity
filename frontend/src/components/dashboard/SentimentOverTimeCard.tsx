/**
 * @file SentimentOverTimeCard.tsx
 * @description Combined sentiment chart that displays sentiment scores over time.
 * Features a toggle button to switch between aggregated and model breakdown views.
 * 
 * REFACTORED (v2.0.0): Now uses centralized utilities for:
 * - Chart data processing (eliminates duplicated logic)
 * - Model filtering (consistent behavior across components)
 * - Sentiment value resolution (fixes current vs historical data discrepancy)
 * - Y-axis scaling and date formatting
 * 
 * Key features:
 * - Single source of truth for current sentiment values
 * - Consistent model filtering logic
 * - Standardized chart data processing
 * - Proper error handling and data validation
 *
 * @dependencies
 * - react: For component state and rendering
 * - recharts: For area chart visualization
 * - lucide-react: For icons
 * - ../../hooks/useDashboard: For dashboard data access
 * - ../../utils/sentimentDataResolver: For centralized sentiment value resolution
 * - ../../utils/chartDataProcessing: For shared chart processing utilities
 * - ../../utils/modelFiltering: For standardized model filtering
 *
 * @exports
 * - SentimentOverTimeCard: The main combined sentiment chart component
 * 
 * @author Dashboard Team
 * @version 2.0.0 - Refactored to use centralized utilities
 */
import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Layers } from 'lucide-react';
import LiquidGlassCard from '../ui/LiquidGlassCard';
import { useDashboard } from '../../hooks/useDashboard';
import { chartColorArrays } from '../../utils/colorClasses';
import { MODEL_CONFIGS, getModelDisplayName } from '../../types/dashboard';
import { 
  resolveCurrentSentimentValue, 
  resolveCurrentSentimentChange,
  debugSentimentResolution 
} from '../../utils/sentimentDataResolver';
import {
  processTimeSeriesData,
  SentimentChartDataPoint,
  SentimentHistoryItem,
  calculateYAxisScaling,
  calculateXAxisInterval,
  parseApiDate,
  formatChartDate
} from '../../utils/chartDataProcessing';

interface SentimentOverTimeCardProps {
  selectedModel?: string;
}

// Using imported interfaces from chartDataProcessing utilities
// ChartDataPoint -> SentimentChartDataPoint
// SentimentHistoryItem -> imported from chartDataProcessing

const SentimentOverTimeCard: React.FC<SentimentOverTimeCardProps> = ({ selectedModel = 'all' }) => {
  const { data, error, filters } = useDashboard();
  const [showModelBreakdown, setShowModelBreakdown] = useState<boolean>(false);
  const [animationKey, setAnimationKey] = useState<number>(0);

  const handleToggleBreakdown = () => {
    setShowModelBreakdown(!showModelBreakdown);
    setAnimationKey(prev => prev + 1); // Force re-render with new animation
  };

  /**
   * Process chart data using centralized utilities
   * Eliminates duplicated logic and ensures consistency with MetricsOverTimeCard
   */
  const { chartData, modelIds } = useMemo(() => {
    if (!data?.sentimentOverTime || !Array.isArray(data.sentimentOverTime)) {
      return { chartData: [], modelIds: [] };
    }

    // Use centralized chart data processing
    const result = processTimeSeriesData<SentimentHistoryItem, SentimentChartDataPoint>(
      data.sentimentOverTime,
      {
        dateRange: (filters?.dateRange || '30d') as any,
        selectedModel,
        showModelBreakdown,
        includeZeroPoint: true,
      },
      // Data transformer function
      (item: SentimentHistoryItem) => {
        const parsedDate = parseApiDate(item.date);
        if (!parsedDate) return null;
        
        return {
          date: formatChartDate(parsedDate),
          score: item.sentimentScore,
          fullDate: item.date,
          // For breakdown mode, the score will be copied to model-specific keys by the processor
        };
      },
      // Value extractor for Y-axis scaling  
      (chartData: SentimentChartDataPoint[], modelIds: string[]) => {
        if (modelIds.length > 0) {
          // Breakdown mode: extract values from all model keys
          return chartData.flatMap(d => 
            modelIds.map(modelId => d[modelId] as number)
              .filter(val => typeof val === 'number' && !isNaN(val))
          );
        } else {
          // Single line mode: extract score values
          return chartData
            .map(d => d.score)
            .filter(val => typeof val === 'number' && !isNaN(val));
        }
      }
    );

    return {
      chartData: result.chartData,  
      modelIds: result.modelIds,
    };
  }, [data?.sentimentOverTime, selectedModel, showModelBreakdown, filters?.dateRange]);

  /**
   * Calculate Y-axis and X-axis configuration using shared utilities
   */
  const { yAxisMax, ticks, xAxisInterval } = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { yAxisMax: 10, ticks: [0, 2, 4, 6, 8, 10], xAxisInterval: 0 };
    }
    
    // Extract values for Y-axis scaling
    let values: number[] = [];
    if (showModelBreakdown && modelIds.length > 0) {
      values = chartData.flatMap(d => 
        modelIds.map(modelId => d[modelId] as number)
          .filter(val => typeof val === 'number' && !isNaN(val))
      );
    } else {
      values = chartData
        .map(d => d.score)
        .filter(val => typeof val === 'number' && !isNaN(val));
    }
    
    // Use centralized Y-axis scaling (sentiment is 0-10 scale, not percentage)
    const { yAxisMax, ticks } = calculateYAxisScaling(values, false, 10);
    
    // Use centralized X-axis interval calculation
    const xAxisInterval = calculateXAxisInterval(chartData.length);
    
    return { yAxisMax, ticks, xAxisInterval };
  }, [chartData, showModelBreakdown, modelIds]);

  /**
   * Gets current sentiment value using centralized resolver
   * Eliminates the 5.0 vs 4.6 discrepancy by establishing clear data hierarchy
   */
  const getCurrentSentimentValue = () => {
    if (!data) return null;
    
    // Use centralized resolver with proper data hierarchy
    const result = resolveCurrentSentimentValue(data, {
      selectedModel,
      dateRange: filters?.dateRange || '30d',
      preferAggregated: selectedModel === 'all',
      minConfidence: 0.5
    });
    
    // Debug in development mode
    if (process.env.NODE_ENV === 'development') {
      debugSentimentResolution('SentimentOverTimeCard.getCurrentValue', data, {
        selectedModel,
        dateRange: filters?.dateRange || '30d'
      });
    }
    
    return result.value;
  };

  /**
   * Gets current sentiment change using centralized resolver
   */
  const getCurrentSentimentChange = () => {
    if (!data) return null;
    
    const result = resolveCurrentSentimentChange(data, {
      selectedModel,
      dateRange: filters?.dateRange || '30d'
    });
    
    return result.change;
  };

  const renderContent = () => {
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
      <div className="flex-1 min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart 
            data={chartData} 
            margin={{ 
              top: 5, 
              right: showModelBreakdown ? 35 : 15,
              bottom: 0, 
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
                textAnchor: chartData.length > 10 ? 'end' : 'middle'
              }}
              tickMargin={chartData.length > 10 ? 2 : 0}
              interval={xAxisInterval}
              angle={chartData.length > 10 ? -45 : 0}
              height={chartData.length > 10 ? 25 : 20}
            />
            <YAxis 
              domain={[0, yAxisMax]}
              ticks={ticks}
              interval={0}
              allowDecimals={false}
              axisLine={{ stroke: '#e2e8f0', strokeWidth: 1 }}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickFormatter={(value) => `${value}`}
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
              content={(props) => {
                if (!props.active || !props.payload || props.payload.length === 0) return null;
                
                // Don't show tooltip for zero points
                if (props.payload[0]?.payload?.isZeroPoint) {
                  return null;
                }
                
                const label = props.label;
                
                if (showModelBreakdown) {
                  // For breakdown mode, show all models at this data point
                  const payload = props.payload.filter(entry => entry.value !== null && entry.value !== undefined);
                  
                  if (payload.length === 0) return null;
                  
                  return (
                    <div style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px',
                      padding: '8px'
                    }}>
                      <p style={{ margin: '0 0 4px 0', fontWeight: 'bold' }}>{label && `Date: ${label}`}</p>
                      {payload.map((entry, index) => (
                        <p key={index} style={{ 
                          margin: index === payload.length - 1 ? 0 : '0 0 2px 0', 
                          color: entry.color || entry.stroke || '#2563eb' 
                        }}>
                          {getModelDisplayName(entry.dataKey as string) || entry.dataKey}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : '0.0'}/10
                        </p>
                      ))}
                    </div>
                  );
                } else {
                  // For single line mode
                  const data = props.payload[0];
                  const value = data.value;
                  const color = data.color || data.stroke || '#2563eb';
                  
                  return (
                    <div style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px',
                      padding: '8px'
                    }}>
                      <p style={{ margin: '0 0 4px 0', fontWeight: 'bold' }}>{label && `Date: ${label}`}</p>
                      <p style={{ margin: 0, color: color }}>
                        Sentiment Score: {typeof value === 'number' ? value.toFixed(1) : '0.0'}/10
                      </p>
                    </div>
                  );
                }
              }}
              cursor={false}
              allowEscapeViewBox={{ x: false, y: false }}
              shared={showModelBreakdown}
              trigger="hover"
              isAnimationActive={false}
              wrapperStyle={{ outline: 'none' }}
            />
            {showModelBreakdown ? (
              // Multi-line mode: render an area for each model with animation
              modelIds.map((modelId, idx) => {
                const color = chartColorArrays.multiColor[idx % chartColorArrays.multiColor.length];
                return (
                  <Area
                    key={`${modelId}-${animationKey}`}
                    type="monotone"
                    dataKey={modelId}
                    name={modelId}
                    stroke={color}
                    fill={color}
                    fillOpacity={0.2}
                    strokeWidth={chartData.length > 1 ? 2 : 0}
                    dot={(props: any) => {
                      if (props.payload?.isZeroPoint) return <g />;
                      return (
                        <circle 
                          cx={props.cx} 
                          cy={props.cy} 
                          r={4} 
                          fill={color}
                          strokeWidth={0}
                        />
                      );
                    }}
                    activeDot={(props: any) => {
                      if (props.payload?.isZeroPoint) return <g />;
                      return (
                        <circle 
                          cx={props.cx} 
                          cy={props.cy} 
                          r={5} 
                          fill={color}
                          strokeWidth={0}
                        />
                      );
                    }}
                    connectNulls={false}
                    isAnimationActive={true}
                    animationBegin={idx * 100}
                    animationDuration={800}
                  />
                );
              })
            ) : (
              // Single-line mode: render one aggregated area
              <Area
                key={`single-${animationKey}`}
                type="monotone"
                dataKey="score"
                stroke="#2563eb"
                fill="#2563eb"
                fillOpacity={0.1}
                strokeWidth={chartData.length > 1 ? 2 : 0}
                dot={(props: any) => {
                  if (props.payload?.isZeroPoint) return <g />;
                  const r = chartData.length === 1 ? 6 : 4;
                  const strokeWidth = chartData.length === 1 ? 2 : 0;
                  const stroke = chartData.length === 1 ? '#ffffff' : '#2563eb';
                  return (
                    <circle 
                      cx={props.cx} 
                      cy={props.cy} 
                      r={r} 
                      fill="#2563eb"
                      strokeWidth={strokeWidth}
                      stroke={stroke}
                    />
                  );
                }}
                activeDot={(props: any) => {
                  if (props.payload?.isZeroPoint) return <g />;
                  return (
                    <circle 
                      cx={props.cx} 
                      cy={props.cy} 
                      r={6} 
                      fill="#2563eb"
                      strokeWidth={1}
                      stroke="#ffffff"
                    />
                  );
                }}
                connectNulls={false}
                isAnimationActive={true}
                animationDuration={600}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
        
        {/* Model icons positioned at the end of each line */}
        {showModelBreakdown && modelIds.length > 0 && chartData.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {(() => {
              const lastDataPoint = chartData[chartData.length - 1];
              
              // Group models by their score value for horizontal offsetting
              const modelsByScore: Record<number, string[]> = {};
              modelIds.forEach(modelId => {
                const value = lastDataPoint[modelId] as number;
                if (value !== undefined && value !== null) {
                  const roundedValue = Math.round(value * 10) / 10; // Round to 1 decimal for grouping
                  if (!modelsByScore[roundedValue]) {
                    modelsByScore[roundedValue] = [];
                  }
                  modelsByScore[roundedValue].push(modelId);
                }
              });

              return modelIds.map((modelId: string) => {
                const value = lastDataPoint[modelId] as number;
                if (value === undefined || value === null) return null;
                
                // Calculate position based on chart dimensions and value
                const chartHeight = 100; // Approximate chart height percentage
                const yPercent = ((yAxisMax - value) / yAxisMax) * chartHeight;
                
                // Calculate horizontal offset for models with same score
                const roundedValue = Math.round(value * 10) / 10;
                const modelsAtSameScore = modelsByScore[roundedValue];
                const indexInGroup = modelsAtSameScore.indexOf(modelId);
                const totalInGroup = modelsAtSameScore.length;
                
                // Calculate horizontal offset (spread models horizontally when they have same score)
                let horizontalOffset = 5; // Default right position
                let zIndex = 1; // Default z-index
                if (totalInGroup > 1) {
                  const spacing = 8; // pixels between icons
                  const totalWidth = (totalInGroup - 1) * spacing;
                  const startOffset = 5 + totalWidth / 2; // Center the group
                  horizontalOffset = startOffset - (indexInGroup * spacing);
                  // Leftmost icon (index 0) gets highest z-index
                  zIndex = totalInGroup - indexInGroup;
                }
                
                const modelConfig = MODEL_CONFIGS[modelId];
                
                return (
                  <div
                    key={`icon-${modelId}`}
                    className="absolute w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center"
                    style={{
                      top: `${Math.max(5, Math.min(85, yPercent - 4))}%`,
                      right: `${horizontalOffset}px`,
                      transform: 'translateY(-50%)',
                      zIndex: zIndex
                    }}
                  >
                    {modelConfig?.logoUrl ? (
                      <img 
                        src={modelConfig.logoUrl} 
                        alt={getModelDisplayName(modelId)}
                        className="w-4 h-4 rounded-full object-contain"
                      />
                    ) : (
                      <span className="text-xs font-bold text-gray-600">
                        {getModelDisplayName(modelId).charAt(0)}
                      </span>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    );
  };

  const currentValue = getCurrentSentimentValue();
  const currentChange = getCurrentSentimentChange();

  return (
    <LiquidGlassCard className="h-full">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-800">Sentiment Over Time</h3>
            {currentValue !== null && typeof currentValue === 'number' && (
              <div className="h-8 px-3 bg-white/60 backdrop-blur-sm border border-white/30 rounded-lg shadow-inner flex items-center justify-center">
                <span className="text-sm font-medium text-gray-700">
                  {currentValue.toFixed(1)}/10
                </span>
              </div>
            )}
            {currentChange !== null && typeof currentChange === 'number' && Math.abs(currentChange) >= 0.1 && (
              <span className={`flex items-center text-xs font-medium ${
                currentChange > 0 ? 'text-green-500' : currentChange < 0 ? 'text-red-500' : 'text-gray-400'
              }`}>
                {currentChange > 0 ? '↗' : currentChange < 0 ? '↘' : '—'}
                {Math.abs(currentChange).toFixed(1)}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleBreakdown}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                showModelBreakdown 
                  ? 'bg-blue-600' 
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
              title={showModelBreakdown ? "Show aggregated view" : "Break down by model"}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 flex items-center justify-center ${
                  showModelBreakdown ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              >
                <Layers size={10} className={showModelBreakdown ? 'text-blue-600' : 'text-gray-400'} />
              </div>
            </button>
          </div>
        </div>
      </div>
      {renderContent()}
    </LiquidGlassCard>
  );
};

export default SentimentOverTimeCard;  