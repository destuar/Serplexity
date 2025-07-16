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
 * - ../../types/dashboard: Type definitions for Metric and SentimentScoreValue.
 *
 * @exports
 * - SentimentScoreDisplayCard: React functional component for displaying sentiment scores in a radar chart.
 */
import { useDashboard } from '../../hooks/useDashboard';
import Card from '../ui/Card';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Metric, SentimentScoreValue } from '../../types/dashboard';

interface SentimentScoreDisplayCardProps {
    selectedModel: string;
}

const SentimentScoreDisplayCard: React.FC<SentimentScoreDisplayCardProps> = ({ selectedModel }) => {
    const { data } = useDashboard();

    const categoryMapping = {
        quality: 'Quality',
        priceValue: 'Price',
        brandReputation: 'Reputation',
        brandTrust: 'Trust',
        customerService: 'Service',
    };

    const sentimentMetrics: Metric<SentimentScoreValue>[] = data?.sentimentDetails?.filter(
        (m) => m.name === 'Detailed Sentiment Scores'
    ) || [];

    let metricToShow: Metric<SentimentScoreValue> | undefined;
    if (selectedModel === 'all') {
        metricToShow = sentimentMetrics.find(m => m.engine === 'serplexity-summary');
    } else {
        metricToShow = sentimentMetrics.find(m => m.engine === selectedModel);
    }

    const detailedScores = metricToShow?.value.ratings[0];

    const chartData = detailedScores
    ? Object.entries(categoryMapping).map(([key, category]) => ({
        category,
        value: detailedScores[key as keyof typeof detailedScores] || 0,
      }))
    : [];

    return (
        <Card className="h-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Sentiment Score</h3>
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart 
                        data={chartData} 
                        margin={{ top: 5, right: 15, bottom: -15, left: 15 }}
                    >
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="category" tick={{ fontSize: 12, fill: '#64748b' }} />
                        <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <Radar name="Score" dataKey="value" stroke="#7762ff" fill="#7762ff" fillOpacity={0.1} />
                        <Tooltip />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};

export default SentimentScoreDisplayCard;
