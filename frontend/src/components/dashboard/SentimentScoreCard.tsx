import { useDashboard } from '../../hooks/useDashboard';
import Card from '../ui/Card';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { getModelDisplayName } from '../../types/dashboard';

const SentimentScoreCard: React.FC = () => {
    const { data, filters } = useDashboard();

    const categoryMapping = {
        quality: 'Quality',
        priceValue: 'Price',
        brandReputation: 'Reputation',
        brandTrust: 'Trust',
        customerService: 'Service',
    };

    const score = data?.sentimentScore;
    // The detailed breakdown for the radar chart might not be in the main object.
    // Let's assume for now it's not available and the card will just show the main score.
    // We can add the detailed breakdown back later if needed via a specific endpoint.
    
    const chartData = score ? Object.keys(categoryMapping).map(key => ({
        category: categoryMapping[key as keyof typeof categoryMapping],
        // Since we don't have the breakdown, we'll just show the overall score for all categories for now.
        // This is a temporary visualization until we decide how to load the breakdown.
        value: score,
    })) : [];

    return (
        <Card className="h-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Sentiment Score: {score ? score.toFixed(1) : 'N/A'}</h3>
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart 
                        data={chartData} 
                        margin={{ top: 5, right: 15, bottom: -15, left: 15 }}
                    >
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="category" tick={{ fontSize: 12, fill: '#64748b' }} />
                        <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <Radar name={getModelDisplayName(filters.aiModel)} dataKey="value" stroke="#7762ff" fill="#7762ff" fillOpacity={0.1} />
                        <Tooltip />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};

export default SentimentScoreCard; 