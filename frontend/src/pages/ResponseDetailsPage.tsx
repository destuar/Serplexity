import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw, Loader, MessageSquare, ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import { useCompany } from '../contexts/CompanyContext';
import { useDashboard } from '../hooks/useDashboard';
import { getTopRankingQuestions, TopRankingQuestion } from '../services/companyService';
import FilterDropdown from '../components/dashboard/FilterDropdown';
import WelcomePrompt from '../components/ui/WelcomePrompt';
import BlankLoadingState from '../components/ui/BlankLoadingState';
import { getModelFilterOptions, DashboardFilters } from '../types/dashboard';
import { getModelDisplayName } from '../types/dashboard';
import { cn } from '../lib/utils';
import { useReportGeneration } from '../hooks/useReportGeneration';

/**
 * Removes <brand> tags from a string, returning the clean text.
 * e.g., "Check out <brand>Apple</brand>." -> "Check out Apple."
 */
const stripBrandTags = (text: string): string => {
    if (!text) return '';
    return text.replace(/<\/?brand>/g, '');
};

/**
 * A component to format and display response text.
 * It handles markdown bolding and highlights brand mentions.
 */
const FormattedResponseViewer: React.FC<{ text: string }> = ({ text }) => {
    const { selectedCompany } = useCompany();
    
    const renderFormattedText = (str: string): React.ReactNode => {
        if (!str) return null;

        // First handle markdown bolding
        const boldPattern = '(\\*\\*.*?\\*\\*)';
        const parts = str.split(new RegExp(boldPattern, 'gi'));

        return (
            <>
                {parts.filter(Boolean).map((part, index) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        const boldText = part.slice(2, -2);
                        return <strong key={index}>{highlightBrandName(boldText)}</strong>;
                    }
                    return <React.Fragment key={index}>{highlightBrandName(part)}</React.Fragment>;
                })}
            </>
        );
    };

    const highlightBrandName = (text: string): React.ReactNode => {
        if (!selectedCompany?.name || !text) return text;

        // Create case-insensitive regex for the brand name
        const brandRegex = new RegExp(`(${selectedCompany.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const parts = text.split(brandRegex);

        return (
            <>
                {parts.map((part, index) => {
                    if (part.toLowerCase() === selectedCompany.name.toLowerCase()) {
                        return (
                            <span key={index} className="font-bold text-[#7762ff]">
                                {part}
                            </span>
                        );
                    }
                    return <React.Fragment key={index}>{part}</React.Fragment>;
                })}
            </>
        );
    };

    return (
        <div className="bg-white rounded-lg p-4 border-l-4 border-green-500 border border-gray-200">
            <p className="text-sm text-gray-800 leading-relaxed">
                {renderFormattedText(text)}
            </p>
        </div>
    );
};

/**
 * Individual response item component - compact with click-to-expand
 */
interface FlattenedResponse { question: string; response: string; model: string; position: number; }

const ResponseItem: React.FC<{ item: FlattenedResponse; index: number }> = ({ item, index }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-200">
            {/* Clickable Question Header */}
            <div 
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="grid grid-cols-12 gap-3 items-center">
                    {/* Ranking Number */}
                    <div className="col-span-1">
                        <p className="text-center text-2xl font-light text-gray-500">
                            {index + 1}
                        </p>
                    </div>
                    
                    {/* Question Text */}
                    <div className="col-span-8 min-w-0">
                        <p className={cn(
                            "text-base text-gray-900 font-medium",
                            !isExpanded && "truncate"
                        )}>
                            {item.question}
                        </p>
                    </div>
                    
                    {/* Right-aligned badges and expand icon */}
                    <div className="col-span-3 flex items-center justify-end gap-2">
                        <span className="bg-[#7762ff]/10 text-[#7762ff] px-1.5 py-0.5 rounded text-xs font-medium border border-[#7762ff]/20">
                            {getModelDisplayName(item.model)}
                        </span>
                        {isExpanded ? (
                            <ChevronUp size={20} className="text-gray-400" />
                        ) : (
                            <ChevronDown size={20} className="text-gray-400" />
                        )}
                    </div>
                </div>
            </div>

            {/* Expandable Response Section */}
            {isExpanded && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <h4 className="font-semibold text-sm text-gray-600 uppercase tracking-wide">
                            Response
                        </h4>
                        <span className="text-xs text-gray-500">
                            from {getModelDisplayName(item.model)}
                        </span>
                    </div>
                    <FormattedResponseViewer text={stripBrandTags(item.response)} />
                </div>
            )}
        </div>
    );
};

// Main page component
const ResponseDetailsPage: React.FC = () => {
    const { selectedCompany } = useCompany();
    const { data: dashboardData, filters, loading: dashboardLoading, refreshing, updateFilters, refreshData, lastUpdated, hasReport, refreshTrigger } = useDashboard();
    
    // ---------------------------
    // Local state
    // ---------------------------
    const [questionsRaw, setQuestionsRaw] = useState<TopRankingQuestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Show limit dropdown (10, 20, 50, all)
    const [showLimit, setShowLimit] = useState<'10' | '20' | '50' | 'all'>('20');

    // Sort dropdown (position, question)
    const [sortBy, setSortBy] = useState<'position' | 'question'>('position');
    const [sortDirection, _setSortDirection] = useState<'asc' | 'desc'>('asc');

    // Report generation logic handled by custom hook
    const { isGenerating, generationStatus, progress, generateReport } = useReportGeneration(selectedCompany);

    // Fetch detailed data for this page (all questions at once)
    const fetchQuestions = useCallback(async () => {
        if (!selectedCompany?.id) return;

        setIsLoading(true);
        setError(null);

        try {
            const modelParam = filters.aiModel === 'all' ? undefined : filters.aiModel;
            const data = await getTopRankingQuestions(selectedCompany.id, { aiModel: modelParam });
            setQuestionsRaw(data.questions);
        } catch (err) {
            console.error('Failed to fetch questions:', err);
            setError('Could not load response details.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedCompany?.id, filters.aiModel]);

    // Initial fetch and re-fetch on filter / limit change
    useEffect(() => {
        // Ensure we have both the report id and a selected company before fetching
        if (dashboardData?.id && selectedCompany?.id) {
            setQuestionsRaw([]);
            fetchQuestions();
        }
    }, [fetchQuestions, filters.aiModel, dashboardData?.id, selectedCompany?.id, showLimit, refreshTrigger]);

    // Process and filter data from the new local state
    const processedResponses = useMemo(() => {
        // Flatten per model
        const flat: FlattenedResponse[] = [];
        questionsRaw.forEach(q => {
            if (q.responses && q.responses.length > 0) {
                q.responses.forEach(r => {
                    flat.push({ question: q.question, response: r.response, model: r.model, position: r.position ?? q.bestPosition });
                });
            } else {
                flat.push({ question: q.question, response: q.bestResponse, model: q.bestResponseModel, position: q.bestPosition });
            }
        });

        // Sorting logic
        flat.sort((a, b) => {
            let comparison = 0;

            switch (sortBy) {
                case 'question':
                    comparison = a.question.localeCompare(b.question);
                    break;
                case 'position':
                    // Lower position number = best position
                    comparison = (a.position ?? 0) - (b.position ?? 0);
                    break;
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });

        // Apply display limit if not showing all
        const limited = showLimit === 'all' ? flat : flat.slice(0, parseInt(showLimit, 10));
        return limited;
    }, [questionsRaw, sortBy, sortDirection, showLimit]);

    const handleRefresh = () => {
      refreshData();
    }

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
                />
            ) : (
                <>
                    {/* Header Section - Always show when there's a report */}
                    <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-2">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Response Details</h1>
                            {lastUpdated && (
                                <p className="text-sm text-gray-500 mt-1">
                                    Last updated: {new Date(lastUpdated).toLocaleString()}
                                </p>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex items-center gap-2 w-full lg:w-auto">
                            <FilterDropdown
                                label="Show"
                                value={showLimit}
                                options={[
                                    { value: '10', label: 'Show 10' },
                                    { value: '20', label: 'Show 20' },
                                    { value: '50', label: 'Show 50' },
                                    { value: 'all', label: 'Show All' },
                                ]}
                                onChange={(value) => setShowLimit(value as typeof showLimit)}
                                icon={MessageSquare}
                                disabled={dashboardLoading || refreshing || isLoading}
                            />
                            <FilterDropdown
                                label="Sort by"
                                value={sortBy}
                                options={[
                                    { value: 'position', label: 'Best Position' },
                                    { value: 'question', label: 'Question Text' },
                                ]}
                                onChange={(value) => setSortBy(value as typeof sortBy)}
                                icon={ArrowUpDown}
                                disabled={dashboardLoading || refreshing || isLoading}
                            />
                            <FilterDropdown
                                label="AI Model"
                                value={filters.aiModel}
                                options={getModelFilterOptions()}
                                onChange={(value) => updateFilters({ aiModel: value as DashboardFilters['aiModel'] })}
                                icon={filters.aiModel === 'all' ? Sparkles : undefined}
                                disabled={dashboardLoading || refreshing || isLoading}
                            />
                            <button 
                                onClick={handleRefresh}
                                disabled={dashboardLoading || refreshing || isLoading}
                                className="flex items-center justify-center w-full md:w-auto gap-2 px-4 py-2 bg-[#7762ff] text-white rounded-lg hover:bg-[#6650e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium col-span-2 sm:col-span-1"
                            >
                                {refreshing || isLoading ? (
                                    <>
                                        <Loader size={16} className="animate-spin" />
                                        <span className="whitespace-nowrap">Refreshing...</span>
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw size={16} />
                                        <span className="whitespace-nowrap">Refresh Data</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Content Area - Show loading state only here */}
                    {!dashboardData || (isLoading && questionsRaw.length === 0) ? (
                        <BlankLoadingState message="Processing response data..." />
                    ) : error ? (
                        <div className="flex-1 min-h-0 p-1 flex items-center justify-center">
                            <div className="text-center p-8">
                                <p className="text-xl font-semibold text-gray-500">Failed to load data. Try refreshing the page.</p>
                                <button
                                    onClick={fetchQuestions}
                                    className="mt-4 px-4 py-2 bg-[#7762ff] text-white rounded-md hover:bg-[#6a55e3] transition-colors flex items-center gap-2 mx-auto"
                                >
                                    <RefreshCw size={16} />
                                    Try Again
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 p-1">
                            <div className="h-full w-full">
                                <div className="h-full overflow-y-auto">
                                    {/* Response Cards Grid */}
                                    {processedResponses.length === 0 ? (
                                        <div className="flex items-center justify-center h-64">
                                            <div className="text-center">
                                                <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
                                                <p className="text-gray-500 text-lg">
                                                    No responses found with current filters
                                                </p>
                                                <p className="text-gray-400 text-sm mt-2">
                                                    Try adjusting your filter settings
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2 pb-6">
                                            {processedResponses.map((item, index) => (
                                                <ResponseItem key={`${item.question}-${item.model}-${index}`} item={item} index={index} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ResponseDetailsPage; 