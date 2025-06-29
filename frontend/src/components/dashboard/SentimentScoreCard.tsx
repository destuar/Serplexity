// A simple comment to refresh the module cache.
import { useDashboard } from '../../hooks/useDashboard';
import Card from '../ui/Card';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Metric, SentimentScoreValue } from '../../types/dashboard';

interface SentimentScoreCardProps {
    selectedModel: string;
}

const SentimentScoreCard: React.FC<SentimentScoreCardProps> = ({ selectedModel }) => {
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

export default SentimentScoreCard; 