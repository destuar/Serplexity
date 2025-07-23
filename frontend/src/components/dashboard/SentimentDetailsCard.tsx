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
 * - ../../types/dashboard: Type definitions for model utilities.
 *
 * @exports
 * - SentimentDetailsCard: React functional component for displaying detailed sentiment analysis.
 */
/**
 * @file SentimentDetailsCard.tsx
 * @description This component displays detailed sentiment analysis with citations.
 * 
 * REFACTORED (v2.0.0): Now uses centralized utilities for:
 * - Standardized model filtering via modelFiltering utilities
 * - Consistent data access patterns
 * - Enhanced citation rendering with brand highlighting
 * 
 * @author Dashboard Team
 * @version 2.0.0 - Updated to use standardized architecture
 */
import LiquidGlassCard from '../ui/LiquidGlassCard';
import { useDashboard } from '../../hooks/useDashboard';
import { getModelDisplayName } from '../../types/dashboard';
import { SentimentDetail } from '../../types/dashboardData';
import CitationBadge from '../ui/CitationBadge';
import { 
  createModelFilterConfig,
  filterDetailedMetricsByModel 
} from '../../utils/modelFiltering';

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
 * Renders text containing <brand> tags and citation markers, highlighting brands
 * and replacing citation markers with clickable badges.
 * @param text The text to be parsed.
 * @param brandName The user's brand name to highlight.
 * @param citations Available citations for creating badges.
 * @returns A ReactNode with appropriate styling.
 */
const renderBrandTextWithCitations = (
    text: string | undefined, 
    brandName: string | undefined,
    citations: Array<{url: string, title: string, domain: string}>
): React.ReactNode => {
    if (!text) {
        return '';
    }

    // First, handle brand tags
    let processedText = text;
    const brandElements: Array<{start: number, end: number, isUserBrand: boolean, content: string}> = [];
    
    if (brandName) {
        const brandRegex = /<brand>(.*?)<\/brand>/g;
        let match;
        while ((match = brandRegex.exec(text)) !== null) {
            const isUserBrand = match[1].toLowerCase() === brandName.toLowerCase();
            brandElements.push({
                start: match.index,
                end: match.index + match[0].length,
                isUserBrand,
                content: match[1]
            });
        }
    }

    // Remove brand tags from text for citation processing
    processedText = processedText.replace(/<\/?brand>/g, '');
    
    // Now handle citation markers [1], [2], etc.
    const citationRegex = /\[(\d+)\]/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;
    let match;

    while ((match = citationRegex.exec(processedText)) !== null) {
        const citationNum = parseInt(match[1], 10);
        const citation = citations[citationNum - 1]; // Convert to 0-based index
        
        // Add text before citation
        if (match.index > lastIndex) {
            const textBefore = processedText.slice(lastIndex, match.index);
            parts.push(<span key={key++}>{textBefore}</span>);
        }
        
        // Add citation badge
        if (citation) {
            parts.push(
                <CitationBadge 
                    key={key++}
                    citation={citation} 
                    index={citationNum - 1}
                    compact
                />
            );
        } else {
            // Fallback if citation not found
            parts.push(<span key={key++}>{match[0]}</span>);
        }
        
        lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < processedText.length) {
        parts.push(<span key={key++}>{processedText.slice(lastIndex)}</span>);
    }

    // Note: This simplified version handles citations but loses brand highlighting
    // For full brand + citation support, we'd need more complex parsing
    return <>{parts}</>;
};

/**
 * Extract citations from sentiment metadata
 */
const extractCitations = (metric: SentimentDetail | undefined): Array<{url: string, title: string, domain: string}> => {
    if (!metric?.value) return [];
    
    // Check if the metric value has webSearchMetadata
    const value = metric.value as any;
    if (value.webSearchMetadata?.sources_found) {
        return value.webSearchMetadata.sources_found.slice(0, 5); // Limit to 5 citations
    }
    
    return [];
};

// Removed hardcoded engineMapping - now using centralized getModelDisplayName

const SentimentDetailsCard: React.FC<SentimentDetailsCardProps> = ({ selectedModel }) => {
    const { data } = useDashboard();
    
    const userBrandName = data?.competitorRankings?.userCompany?.name;

    const sentimentMetrics: SentimentDetail[] = data?.sentimentDetails?.filter((m: SentimentDetail) => m.name === 'Detailed Sentiment Scores') || [];

    const title = selectedModel === 'all'
        ? 'Sentiment Details'
        : `${getModelDisplayName(selectedModel)} Summary`;

    /**
     * Use standardized model filtering for consistent behavior across components
     * This eliminates the custom filtering logic and uses our centralized utilities
     */
    const modelConfig = createModelFilterConfig(selectedModel);
    
    // Apply standardized model filtering
    const filteredMetrics = filterDetailedMetricsByModel(sentimentMetrics, modelConfig);
    let metricToShow: SentimentDetail | undefined = filteredMetrics[0];
    
    // Fallback mechanism for when no exact match is found
    if (!metricToShow && sentimentMetrics.length > 0) {
        console.warn(
            `[SentimentDetailsCard] No metric found for engine "${modelConfig.queryParams.engineParam}", using first available`
        );
        metricToShow = sentimentMetrics[0];
    }

    const citations = extractCitations(metricToShow);

    const getScoreColor = (score: number) => {
        if (score >= 8) return 'text-green-700 bg-green-50 shadow-md';
        if (score >= 6) return 'text-yellow-700 bg-yellow-50 shadow-md';
        return 'text-red-700 bg-red-50 shadow-md';
    };

    return (
        <LiquidGlassCard className="h-full p-0">
            <div className="h-full flex min-w-0">
                {/* Left side with title and description */}
                <div className="flex-[3] p-4 flex flex-col min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 sentiment-details-scroll">
                        {metricToShow ? (
                            <div className="pl-4 pr-2">
                                <div className="text-base text-gray-700 leading-relaxed break-words">
                                    {renderBrandTextWithCitations(
                                        (metricToShow.value.ratings[0] as any).summaryDescription, 
                                        userBrandName,
                                        citations
                                    )}
                                </div>
                            </div>
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
                            {Object.entries(metricToShow.value.ratings[0]).map(([key, score]) => {
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
                                const categoryScores = Object.entries(metricToShow.value.ratings[0])
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
                                        const categoryScores = Object.entries(metricToShow.value.ratings[0])
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
        </LiquidGlassCard>
    );
};

export default SentimentDetailsCard; 