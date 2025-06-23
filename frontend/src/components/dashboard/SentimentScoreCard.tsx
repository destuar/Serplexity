import { useDashboard } from '../../hooks/useDashboard';
import { useCompany } from '../../contexts/CompanyContext';
import Card from '../ui/Card';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Metric, SentimentScoreValue } from '../../types/dashboard';

interface SentimentScoreCardProps {
    selectedModel?: string;
}

const SentimentScoreCard: React.FC<SentimentScoreCardProps> = ({ selectedModel: selectedModelProp }) => {
    const { data, filters } = useDashboard();
    const { selectedCompany } = useCompany();
    const selectedModel = selectedModelProp ?? filters.aiModel;

    const processData = () => {
        const sentimentMetrics: Metric[] = data?.metrics.filter((m: Metric) => m.name === 'Detailed Sentiment Scores') || [];
        if (!sentimentMetrics.length) {
            return { chartData: [], companyName: selectedCompany?.name || 'Company', displayData: { subject: 'No Data' } };
        }
    
        const categoryMapping = {
            quality: 'Quality',
            priceValue: 'Price',
            brandReputation: 'Reputation',
            brandTrust: 'Trust',
            customerService: 'Service',
        };

        let displayData: { subject: string, fullMark: number, [key: string]: number | string } = { subject: 'Select a Model', fullMark: 10 };

        if (selectedModel === 'all') {
            const summaryMetric = sentimentMetrics.find(m => m.engine === 'serplexity-summary');
            if (summaryMetric) {
                const value = summaryMetric.value as SentimentScoreValue;
                displayData = { subject: 'All Models (Avg)', ...value.ratings[0], fullMark: 10 };
            } else {
                 displayData = { subject: 'No Summary Data', fullMark: 10 };
            }
        } else {
            const modelData = sentimentMetrics.find(m => m.engine === selectedModel);
            if (modelData) {
                const value = modelData.value as SentimentScoreValue;
                displayData = { subject: modelData.engine, ...value.ratings[0], fullMark: 10 };
            } else {
                 displayData = { subject: `No data for ${selectedModel}`, fullMark: 10 };
            }
        }
        
        const chartData = Object.keys(categoryMapping).map(key => ({
            category: categoryMapping[key as keyof typeof categoryMapping],
            value: displayData[key] || 0,
        }));
        
        return { chartData, companyName: selectedCompany?.name || 'Company', displayData };
    };
    
    const { chartData, displayData } = processData();
    
    return (
        <Card className="h-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Sentiment Score Analysis</h3>
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart 
                        key={`sentiment-radar-${selectedModel}`}
                        data={chartData} 
                        margin={{ top: 5, right: 15, bottom: -15, left: 15 }}
                    >
                        <PolarGrid 
                            stroke="#e2e8f0" 
                            strokeWidth={1}
                            gridType="polygon"
                            radialLines={true}
                        />
                        <PolarAngleAxis 
                            dataKey="category" 
                            tick={{ fontSize: 12, fill: '#64748b' }}
                            className="text-sm font-medium"
                        />
                        <PolarRadiusAxis 
                            angle={90} 
                            domain={[0, 10]} 
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            tickCount={6}
                            tickFormatter={(value) => value.toString()}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Radar
                            name={displayData.subject}
                            dataKey="value"
                            stroke="#7762ff"
                            fill="#7762ff"
                            fillOpacity={0.1}
                            strokeWidth={2}
                        />
                        <Tooltip 
                            contentStyle={{
                                backgroundColor: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                            formatter={(value: number) => [value.toFixed(1), 'Score']}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};

export default SentimentScoreCard; 