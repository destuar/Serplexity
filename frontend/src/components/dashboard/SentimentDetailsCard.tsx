/**
 * @file SentimentDetailsCard.tsx
 * @description This component displays detailed sentiment analysis including a comprehensive text summary
 * and categorical score breakdowns (Quality, Price/Value, Brand Reputation, Trust, Customer Service).
 * It features smart brand highlighting that emphasizes the user's brand mentions while keeping competitor
 * mentions neutral. The component filters sentiment data by selected AI model and provides both qualitative
 * insights and quantitative metrics in a split-view layout.
 *
 * @dependencies
 * - react: The core React library.
 * - ../ui/Card: Generic card component for consistent UI.
 * - ../../hooks/useDashboard: Custom hook for accessing dashboard data.
 * - ../../types/dashboard: Type definitions for Metric, SentimentScoreValue, and utility functions.
 *
 * @exports
 * - SentimentDetailsCard: React functional component for displaying detailed sentiment analysis.
 */
import Card from '../ui/Card';
import { useDashboard } from '../../hooks/useDashboard';
import { Metric, SentimentScoreValue, getModelDisplayName } from '../../types/dashboard';

interface SentimentDetailsCardProps {
    selectedModel: string;
}

const categoryMapping: { [key: string]: string } = {
    quality: 'Quality',
    priceValue: 'Price/Value',
    brandReputation: 'Brand Reputation',
    brandTrust: 'Brand Trust',
    customerService: 'Customer Service',
};

/**
 * Renders text containing <brand> tags, highlighting the user's brand
 * and stripping tags from competitor brands.
 * @param text The text to be parsed.
 * @param brandName The user's brand name to highlight.
 * @returns A ReactNode with appropriate styling.
 */
const renderBrandText = (text: string | undefined, brandName: string | undefined): React.ReactNode => {
    if (!text) {
        return '';
    }
    // If we don't have a brand name to highlight, just strip all tags for a clean view.
    if (!brandName) {
        return text.replace(/<\/?brand>/g, '');
    }

    // Split the string by the <brand> tags, but keep the tags as delimiters.
    // This allows us to know which segments were inside tags.
    const parts = text.split(/(<\/?brand>)/g);

    const elements: React.ReactNode[] = [];
    let isBrand = false;
    let key = 0;

    for (const part of parts) {
        if (part === '<brand>') {
            isBrand = true;
            continue;
        }
        if (part === '</brand>') {
            isBrand = false;
            continue;
        }
        if (!part) {
            continue;
        }

        if (isBrand) {
            const isUserBrand = part.toLowerCase() === brandName.toLowerCase();
            elements.push(
                <span
                    key={key++}
                    className={
                        isUserBrand
                            ? "text-blue-600 font-semibold transition-colors duration-200 hover:bg-blue-100 rounded px-1 -mx-1"
                            : "" // No special styling for competitors
                    }
                >
                    {part}
                </span>
            );
        } else {
            elements.push(<span key={key++}>{part}</span>);
        }
    }

    return <>{elements}</>;
};

// Removed hardcoded engineMapping - now using centralized getModelDisplayName

/*
const MetricDetailsView: React.FC<{ value: SentimentScoreValue }> = ({ value }) => {
    // Calculate average score
    const categoryScores = Object.entries(value.ratings[0])
        .filter(([key, score]) => typeof score === 'number' && categoryMapping[key])
        .map(([_, score]) => score as number);
    
    const averageScore = categoryScores.length > 0 
        ? categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length 
        : 0;

    // Function to get color based on score
    const getScoreColor = (score: number) => {
        if (score >= 8) return 'text-green-700 bg-green-50 shadow-md';
        if (score >= 6) return 'text-yellow-700 bg-yellow-50 shadow-md';
        return 'text-red-700 bg-red-50 shadow-md';
    };

    const getAverageScoreColor = (score: number) => {
        if (score >= 8) return 'text-green-800 bg-green-100 border-green-300';
        if (score >= 6) return 'text-yellow-800 bg-yellow-100 border-yellow-300';
        return 'text-red-800 bg-red-100 border-red-300';
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:flex-[3]">
                <p className="text-base text-gray-700 leading-relaxed">
                    {value.ratings[0].summaryDescription}
                </p>
            </div>
            <div className="lg:flex-[2]">
                <div className="flex flex-wrap gap-3">
                    {Object.entries(value.ratings[0]).map(([key, score]) => {
                        if (typeof score === 'number' && categoryMapping[key]) {
                            return (
                                <div key={key} className={`flex-[0_0_calc(50%-6px)] rounded-lg p-3 ${getScoreColor(score)}`}>
                                    <div className="text-xs font-semibold mb-2 leading-tight uppercase tracking-wide">{categoryMapping[key]}</div>
                                    <div className="text-lg font-bold">
                                        {(score as number).toFixed(1)}<span className="text-sm font-medium opacity-70">/10</span>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })}
                    
                    <div className={`w-full rounded-lg p-3 ${getScoreColor(averageScore)}`}>
                        <div className="text-xs font-semibold mb-2 leading-tight uppercase tracking-wide">Average Score</div>
                        <div className="text-lg font-bold">
                            {averageScore.toFixed(1)}<span className="text-sm font-medium opacity-70">/10</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
*/

const SentimentDetailsCard: React.FC<SentimentDetailsCardProps> = ({ selectedModel }) => {
    const { data } = useDashboard();
    
    const userBrandName = data?.competitorRankings?.userCompany?.name;

    const sentimentMetrics: Metric[] = data?.sentimentDetails?.filter((m: Metric) => m.name === 'Detailed Sentiment Scores') || [];

    const title = selectedModel === 'all'
        ? 'Sentiment Details'
        : `${getModelDisplayName(selectedModel)} Summary`;

    let metricToShow: Metric | undefined;
    if (selectedModel === 'all') {
        metricToShow = sentimentMetrics.find(m => m.engine === 'serplexity-summary');
        if (!metricToShow && sentimentMetrics.length > 0) {
            metricToShow = sentimentMetrics[0];
        }
    } else {
        metricToShow = sentimentMetrics.find(m => m.engine === selectedModel);
    }

    const getScoreColor = (score: number) => {
        if (score >= 8) return 'text-green-700 bg-green-50 shadow-md';
        if (score >= 6) return 'text-yellow-700 bg-yellow-50 shadow-md';
        return 'text-red-700 bg-red-50 shadow-md';
    };

    return (
        <Card className="h-full p-0">
            <div className="h-full flex min-w-0">
                {/* Left side with title and description */}
                <div className="flex-[3] p-4 flex flex-col min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 sentiment-details-scroll">
                        {metricToShow ? (
                            <p className="text-base text-gray-700 leading-relaxed pl-4 break-words pr-2">
                                {renderBrandText((metricToShow.value as SentimentScoreValue).ratings[0].summaryDescription, userBrandName)}
                            </p>
                        ) : (
                            <div className="text-center py-12">
                                <div className="text-gray-400 mb-2">
                                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <p className="text-gray-500 text-sm font-medium">No sentiment details available</p>
                                <p className="text-gray-400 text-xs mt-1">Data for the selected model is not available</p>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Right side with metric cards - full height */}
                <div className="flex-[2] p-6 flex items-start min-w-0">
                    {metricToShow && (
                        <div className="flex flex-wrap gap-3 w-full">
                            {Object.entries((metricToShow.value as SentimentScoreValue).ratings[0]).map(([key, score]) => {
                                if (typeof score === 'number' && categoryMapping[key]) {
                                    return (
                                        <div key={key} className={`flex-[0_0_calc(50%-6px)] rounded-lg p-2 ${getScoreColor(score)}`}>
                                            <div className="text-xs font-semibold mb-1 leading-tight uppercase tracking-wide">{categoryMapping[key]}</div>
                                            <div className="text-sm font-bold">
                                                {(score as number).toFixed(1)}<span className="text-xs font-medium opacity-70">/10</span>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })}
                            {/* Average Score Card */}
                            <div className={`flex-[0_0_calc(50%-6px)] rounded-lg p-2 ${(() => {
                                const categoryScores = Object.entries((metricToShow.value as SentimentScoreValue).ratings[0])
                                    .filter(([, score]) => typeof score === 'number')
                                    .map(([, score]) => score as number);
                                const averageScore = categoryScores.length > 0 
                                    ? categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length 
                                    : 0;
                                return getScoreColor(averageScore);
                            })()}`}>
                                <div className="text-xs font-semibold mb-1 leading-tight uppercase tracking-wide">Average Score</div>
                                <div className="text-sm font-bold">
                                    {(() => {
                                        const categoryScores = Object.entries((metricToShow.value as SentimentScoreValue).ratings[0])
                                            .filter(([, score]) => typeof score === 'number')
                                            .map(([, score]) => score as number);
                                        const averageScore = categoryScores.length > 0 
                                            ? categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length 
                                            : 0;
                                        return averageScore.toFixed(1);
                                    })()}<span className="text-xs font-medium opacity-70">/10</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
};

export default SentimentDetailsCard; 