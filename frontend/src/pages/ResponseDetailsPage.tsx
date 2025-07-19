/**
 * @file ResponseDetailsPage.tsx
 * @description Response details page for viewing detailed AI response analysis.
 * Provides comprehensive response breakdown, sentiment analysis, and performance metrics.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - react-router-dom: For navigation.
 * - lucide-react: For icons.
 * - ../contexts/DashboardContext: For dashboard data.
 *
 * @exports
 * - ResponseDetailsPage: The main response details page component.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles, RefreshCw, Loader, MessageSquare, ListFilter, ChevronDown, ChevronUp } from 'lucide-react';
import { useCompany } from '../contexts/CompanyContext';
import { useDashboard } from '../hooks/useDashboard';
import { getTopRankingQuestions, TopRankingQuestion } from '../services/companyService';
import FilterDropdown from '../components/dashboard/FilterDropdown';
import WelcomePrompt from '../components/ui/WelcomePrompt';
import BlankLoadingState from '../components/ui/BlankLoadingState';
import FormattedResponseViewer from '../components/ui/FormattedResponseViewer';
import { getModelFilterOptions, DashboardFilters } from '../types/dashboard';
import { getModelDisplayName } from '../types/dashboard';
import { cn } from '../lib/utils';
import { useReportGeneration } from '../hooks/useReportGeneration';
import { FANOUT_QUESTION_TYPES, FANOUT_DISPLAY_LABELS, FanoutQuestionType } from '../types/responses';

/**
 * Removes <brand> tags from a string, returning the clean text.
 * e.g., "Check out <brand>Apple</brand>." -> "Check out Apple."
 */
const stripBrandTags = (text: string): string => {
    if (!text) return '';
    return text.replace(/<\/?brand>/g, '');
};



/**
 * Individual response item component - compact with click-to-expand
 */
interface FlattenedResponse { 
  question: string; 
  response: string; 
  model: string; 
  position: number | null; // Individual model's position for this response
  questionType?: string; 
  bestPosition: number | null; // Question's best position across all models (what users expect to see)
  questionId: string; // Add question ID for grouping
}

const ResponseItem: React.FC<{ item: FlattenedResponse; autoExpand?: boolean }> = ({ item, autoExpand=false }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // auto expand if prop true on first render
    useEffect(() => {
        if (autoExpand) {
            setIsExpanded(true);
        }
    }, [autoExpand]);

    const questionTypeBadge = item.questionType && item.questionType in FANOUT_DISPLAY_LABELS 
        ? FANOUT_DISPLAY_LABELS[item.questionType as FanoutQuestionType]
        : item.questionType;

    // Determine what to show as the primary ranking:
    // Only show model-specific position or N/A - NO fallback to bestPosition
    // This ensures responses without brand mentions display 'N/A' correctly
    const primaryRanking = item.position !== null ? item.position : 'N/A';

    const hasIndividualPosition = item.position !== null && item.position !== item.bestPosition;

    return (
        <div id={`question-${item.questionId}`} className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-200">
            {/* Clickable Question Header */}
            <div 
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="grid grid-cols-12 gap-3 items-center">
                    {/* Ranking Number with "Rank:" prefix - show question's best position */}
                    <div className="col-span-2">
                        <p className="text-sm font-medium text-gray-600">
                            Rank: {primaryRanking}
                        </p>
                    </div>
                    
                    {/* Question Text */}
                    <div className="col-span-7 min-w-0">
                        <p 
                            className={cn(
                                "text-base text-gray-900 font-medium",
                                !isExpanded && "truncate"
                            )}
                            title={!isExpanded ? `${item.question}\n\nResponse preview: ${stripBrandTags(item.response).substring(0, 200)}${stripBrandTags(item.response).length > 200 ? '...' : ''}` : undefined}
                        >
                            {item.question}
                        </p>
                    </div>
                    
                    {/* All labels on one line */}
                    <div className="col-span-3 flex items-center justify-end gap-2 text-xs">
                        {questionTypeBadge && (
                            <span className="inline-block px-2 py-1 font-medium bg-blue-100 text-blue-800 rounded-full whitespace-nowrap">
                                {questionTypeBadge}
                            </span>
                        )}
                        <span className="bg-[#7762ff]/10 text-[#7762ff] px-2 py-1 rounded font-medium border border-[#7762ff]/20 whitespace-nowrap">
                            {getModelDisplayName(item.model)}
                        </span>
                        {isExpanded ? (
                            <ChevronUp size={20} className="text-gray-400 flex-shrink-0" />
                        ) : (
                            <ChevronDown size={20} className="text-gray-400 flex-shrink-0" />
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
                        {/* Show individual model position if different from best position */}
                        {hasIndividualPosition && (
                            <span className="text-xs text-gray-500 ml-2">
                                (This model ranked #{item.position})
                            </span>
                        )}
                    </div>
                    <div className="text-sm">
                        <FormattedResponseViewer text={stripBrandTags(item.response)} />
                    </div>
                </div>
            )}
        </div>
    );
};

// Main page component
const ResponseDetailsPage: React.FC = () => {
    const { selectedCompany } = useCompany();
    const [searchParams] = useSearchParams();
    const initialQuestionId = searchParams.get('questionId');
    const { data: dashboardData, filters, loading: dashboardLoading, refreshing, updateFilters, refreshData, lastUpdated, hasReport, refreshTrigger } = useDashboard();
    
    // ---------------------------
    // Local state
    // ---------------------------
    const [questionsRaw, setQuestionsRaw] = useState<TopRankingQuestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Show limit dropdown (10, 20, 50, all)
    const [showLimit, setShowLimit] = useState<'10' | '20' | '50' | 'all'>('20');

    // Question type filter (replaces sort functionality)
    const [questionTypeFilter, setQuestionTypeFilter] = useState<FanoutQuestionType | 'all'>('all');

    // Report generation logic handled by custom hook
    const { 
      isGenerating, 
      generationStatus, 
      progress, 
      generateReport, 
      isButtonDisabled, 
      generationState, 
       
    } = useReportGeneration(selectedCompany);

    // Initial fetch and re-fetch on filter change
    useEffect(() => {
        // Only fetch if we have the required data and filters have actually changed
        if (dashboardData?.id && selectedCompany?.id) {
            console.log('[ResponseDetailsPage] useEffect triggered - filters changed, fetching questions');
            setQuestionsRaw([]);
            
            // Inline the fetch logic to avoid dependency issues
            const doFetch = async () => {
                try {
                    setIsLoading(true);
                    const modelParam = filters.aiModel === 'all' ? undefined : filters.aiModel;
                    const typeParam = questionTypeFilter === 'all' ? undefined : questionTypeFilter;
                    console.log('[ResponseDetailsPage] Fetching questions for company:', selectedCompany.id, 'model:', modelParam, 'type:', typeParam);
                    const data = await getTopRankingQuestions(selectedCompany.id, { 
                        aiModel: modelParam,
                        questionType: typeParam 
                    });
                    console.log('[ResponseDetailsPage] Raw API response:', data);
                    console.log('[ResponseDetailsPage] Questions received:', data.questions?.length || 0);
                    
                    // Debug: Check for shared rankings in the raw data
                    if (data.questions && Array.isArray(data.questions)) {
                        const questionsWithRank1 = data.questions.filter((q: TopRankingQuestion) => q.bestPosition === 1);
                        const questionsWithoutMentions = data.questions.filter((q: TopRankingQuestion) => q.bestPosition === null);
                        const questionsWithBadData = data.questions.filter((q: TopRankingQuestion) => q.bestPosition === 1 && q.totalMentions === 0);
                        
                        console.log('[ResponseDetailsPage] Debug stats:');
                        console.log('- Questions with rank 1:', questionsWithRank1.length);
                        console.log('- Questions without mentions (null bestPosition):', questionsWithoutMentions.length);
                        console.log('- Questions with rank 1 but 0 mentions (BUG):', questionsWithBadData.length);
                        
                        if (questionsWithBadData.length > 0) {
                            console.warn('[ResponseDetailsPage] FOUND BUGGY DATA - Questions with rank 1 but no mentions:');
                            questionsWithBadData.slice(0, 3).forEach((q: TopRankingQuestion, i: number) => {
                                console.warn(`${i + 1}. "${q.question?.substring(0, 50)}..." - bestPosition: ${q.bestPosition}, totalMentions: ${q.totalMentions}`);
                            });
                        }
                    }
                    
                    setQuestionsRaw(data.questions || []);
                    setError(null);
                } catch (err) {
                    console.error('Error fetching questions:', err);
                    setError('Failed to load response data');
                } finally {
                    setIsLoading(false);
                }
            };
            
            // Small delay to debounce rapid filter changes
            const timeoutId = setTimeout(doFetch, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [
        dashboardData?.id, 
        selectedCompany?.id, 
        filters.aiModel, 
        questionTypeFilter,
        refreshTrigger
    ]);

    // Process and filter data from the new local state
    const processedResponses = useMemo(() => {
        console.log('[ResponseDetailsPage] Processing responses from questionsRaw:', questionsRaw.length, 'questions');
        
        // 10x APPROACH: Backend now sends response-level data directly
        // No need for complex grouping - just transform to expected format
        const responses: FlattenedResponse[] = questionsRaw.map(q => {
            // Extract the single response (backend now sends one row per response)
            const response = q.responses && q.responses.length > 0 ? q.responses[0] : {
                model: q.bestResponseModel,
                response: q.bestResponse,
                position: q.averagePosition ?? null, // Use averagePosition as it's the model-specific position
                createdAt: undefined
            };

            return {
                question: q.question,
                response: response.response,
                model: response.model,
                position: response.position ?? null,
                questionType: q.type,
                bestPosition: q.bestPosition,
                questionId: q.id
            };
        });

        // Apply client-side limit for UI control
        const limited = showLimit === 'all' ? responses : responses.slice(0, parseInt(showLimit, 10));

        console.log('[ResponseDetailsPage] Processed', responses.length, 'responses, showing', limited.length, 'after limit');
        
        return limited;
    }, [questionsRaw, showLimit]);

    useEffect(() => {
        if (initialQuestionId) {
            const el = document.getElementById(`question-${initialQuestionId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, [processedResponses, initialQuestionId]);

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
                    isButtonDisabled={isButtonDisabled}
                    generationState={generationState}
                />
            ) : (
                <>
                    {/* Header Section - Always show when there's a report */}
                    <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-2">
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
                                label="Question Type"
                                value={questionTypeFilter}
                                options={[
                                    { value: 'all', label: 'All Types' },
                                    ...FANOUT_QUESTION_TYPES.map(type => ({
                                        value: type,
                                        label: FANOUT_DISPLAY_LABELS[type]
                                    }))
                                ]}
                                onChange={(value) => setQuestionTypeFilter(value as FanoutQuestionType | 'all')}
                                icon={ListFilter}
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
                        <div>
                            {lastUpdated && (
                                <p className="text-sm text-gray-500">
                                    Last updated: {new Date(lastUpdated).toLocaleString()}
                                </p>
                            )}
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
                                    onClick={() => {
                                        setQuestionsRaw([]); // Clear current data to force re-fetch
                                        refreshData();
                                    }}
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
                                <div className="h-full overflow-y-auto p-2">
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
                                        <div className="space-y-3 pb-2">
                                            {processedResponses.map((item, index) => (
                                                <ResponseItem 
                                                    key={`${item.questionType}-${item.model}-${index}-${item.question.substring(0,20)}`}
                                                    item={item} 
                                                    autoExpand={item.questionId === initialQuestionId}
                                                />
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