/**
 * @file SentimentScoreDisplayCard.tsx
 * @description This component displays a radar chart visualizing detailed sentiment scores across various
 * categories (Quality, Price, Reputation, Trust, Service). It fetches sentiment data from the `useDashboard` hook
 * and filters it based on the selected AI model. This component provides a quick, multi-dimensional view of brand sentiment.
 *
 * @dependencies
 * - react: The core React library.
 * - ../../hooks/useDashboard: Custom hook for accessing dashboard data.
 * - ../ui/Card: Generic card component for consistent UI.
 * - recharts: A customizable charting library for React.
 * - ../../types/dashboard: Type definitions for model utilities.
 *
 * @exports
 * - SentimentScoreDisplayCard: React functional component for displaying sentiment scores in a radar chart.
 */
import { useDashboard } from '../../hooks/useDashboard';
import LiquidGlassCard from '../ui/LiquidGlassCard';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { SentimentDetail } from '../../types/dashboardData';
import { createModelFilterConfig, filterDetailedMetricsByModel } from '../../utils/modelFiltering';
import { ArrowRight } from 'lucide-react';

interface SentimentScoreDisplayCardProps {
    selectedModel: string;
    onSeeMore?: () => void;
}

const SentimentScoreDisplayCard: React.FC<SentimentScoreDisplayCardProps> = ({ selectedModel, onSeeMore }) => {
    const { data } = useDashboard();

    const categoryMapping = {
        quality: 'Quality',
        priceValue: 'Price',
        brandReputation: 'Reputation',
        brandTrust: 'Trust',
        customerService: 'Service',
    };

    const sentimentMetrics: SentimentDetail[] = data?.sentimentDetails?.filter(
        (m) => m.name === 'Detailed Sentiment Scores' || m.name === 'Overall Sentiment Summary'
    ) || [];

    // Use standardized model filtering for consistent behavior
    const modelConfig = createModelFilterConfig(selectedModel);
    const filteredMetrics = filterDetailedMetricsByModel(sentimentMetrics, modelConfig);
    let metricToShow: SentimentDetail | undefined = filteredMetrics[0];
    
    // Fallback mechanism for when no exact match is found
    if (!metricToShow && sentimentMetrics.length > 0) {
        console.warn(
            `[SentimentScoreDisplayCard] No metric found for engine "${modelConfig.queryParams.engineParam}", using first available`
        );
        metricToShow = sentimentMetrics[0];
    }

    const detailedScores = metricToShow?.value.ratings[0];

    const chartData = detailedScores
    ? Object.entries(categoryMapping).map(([key, category]) => ({
        category,
        value: detailedScores[key as keyof typeof detailedScores] || 0,
      }))
    : [];

    return (
        <LiquidGlassCard className="h-full">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-800">Sentiment Score</h3>
                {onSeeMore && (
                    <button
                        onClick={onSeeMore}
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        See More
                        <ArrowRight size={14} />
                    </button>
                )}
            </div>
            <div className="flex-1 min-h-0" style={{ minHeight: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart 
                        data={chartData} 
                        margin={{ top: 5, right: 15, bottom: -15, left: 15 }}
                    >
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="category" tick={{ fontSize: 12, fill: '#64748b' }} />
                        <PolarRadiusAxis angle={90} domain={[0, 10]} tick={false} />
                        <Radar name="Score" dataKey="value" stroke="#2563eb" strokeWidth={1} fill="#2563eb" fillOpacity={0.1} />
                        <Tooltip 
                            contentStyle={{
                                backgroundColor: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                fontSize: '12px',
                                padding: '8px'
                            }}
                            labelStyle={{
                                color: '#1f2937',
                                fontWeight: 'bold',
                                marginBottom: '4px'
                            }}
                            itemStyle={{
                                color: '#2563eb',
                                fontSize: '12px'
                            }}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
        </LiquidGlassCard>
    );
};

export default SentimentScoreDisplayCard;
