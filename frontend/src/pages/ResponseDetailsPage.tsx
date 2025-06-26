import React, { useState, useMemo } from 'react';
import { Calendar, Sparkles, RefreshCw, Loader, MessageSquare, ArrowUpDown, Filter, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useCompany } from '../contexts/CompanyContext';
import { useDashboard } from '../hooks/useDashboard';
import { triggerReportGeneration } from '../services/reportService';
import { generateCompetitors } from '../services/companyService';
import FilterDropdown from '../components/dashboard/FilterDropdown';
import WelcomePrompt from '../components/ui/WelcomePrompt';
import Card from '../components/ui/Card';
import { getModelFilterOptions, DashboardFilters } from '../types/dashboard';
import { TopRankingQuestion } from '../services/companyService';
import { getModelDisplayName } from '../types/dashboard';
import { cn } from '../lib/utils';

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
interface ResponseItemProps {
    question: TopRankingQuestion;
    index: number;
}

const ResponseItem: React.FC<ResponseItemProps> = ({ question, index }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const getPositionColor = (position: number) => {
        if (position <= 3) return 'text-green-700 bg-green-100';
        if (position <= 5) return 'text-yellow-700 bg-yellow-100';
        return 'text-red-700 bg-red-100';
    };

    const getQuestionTypeColor = (type: string) => {
        switch (type) {
            case 'visibility': return 'text-blue-700 bg-blue-100';
            case 'benchmark': return 'text-purple-700 bg-purple-100';
            case 'personal': return 'text-green-700 bg-green-100';
            default: return 'text-gray-700 bg-gray-100';
        }
    };

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
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#7762ff] text-white text-sm font-bold">
                            #{index + 1}
                        </div>
                    </div>
                    
                    {/* Question Text - controlled width */}
                    <div className="col-span-7 min-w-0">
                        <p className={cn(
                            "text-base text-gray-900 font-medium",
                            !isExpanded && "truncate"
                        )}>
                            {question.question}
                        </p>
                    </div>
                    
                    {/* Right-aligned badges and expand icon */}
                    <div className="col-span-4 flex items-center justify-end gap-2">
                        {question.totalMentions === 0 && (
                            <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-xs font-medium">
                                Not Mentioned
                            </span>
                        )}
                        <span className={cn(
                            "px-1.5 py-0.5 rounded text-xs font-medium capitalize",
                            getQuestionTypeColor(question.type)
                        )}>
                            {question.type}
                        </span>
                        <span className="bg-[#7762ff]/10 text-[#7762ff] px-1.5 py-0.5 rounded text-xs font-medium border border-[#7762ff]/20">
                            {getModelDisplayName(question.bestResponseModel)}
                        </span>
                        {question.productName && (
                            <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-xs font-medium">
                                {question.productName}
                            </span>
                        )}
                        {/* Expand/Collapse Icon */}
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
                        <div className={cn(
                            "w-2 h-2 rounded-full",
                            question.totalMentions === 0 ? "bg-orange-500" : "bg-green-500"
                        )}></div>
                        <h4 className="font-semibold text-sm text-gray-600 uppercase tracking-wide">
                            {question.totalMentions === 0 ? "Sample Response" : "Best Response"}
                        </h4>
                        <span className="text-xs text-gray-500">
                            from {getModelDisplayName(question.bestResponseModel)}
                        </span>
                        {question.totalMentions === 0 && (
                            <span className="text-xs text-orange-600 font-medium">
                                (Your company not mentioned)
                            </span>
                        )}
                    </div>
                    <FormattedResponseViewer 
                        text={stripBrandTags(question.bestResponse)} 
                    />
                </div>
            )}
        </div>
    );
};

// Main page component
const ResponseDetailsPage: React.FC = () => {
    const { selectedCompany } = useCompany();
    const { data, filters, loading, refreshing, updateFilters, refreshData, lastUpdated } = useDashboard();
    
    // Local page state
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationStatus, setGenerationStatus] = useState<string | null>(null);
    const [questionTypeFilter, setQuestionTypeFilter] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'position' | 'question' | 'model' | 'mentions'>('position');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [displayLimit, setDisplayLimit] = useState<number>(20);

    // Check if we have data to show
    const hasExistingData = data && Object.keys(data).length > 0 && data.topQuestions;

    // Filter and sort options
    const aiModelOptions = getModelFilterOptions();
    
    const questionTypeOptions = [
        { value: 'all', label: 'All Types' },
        { value: 'visibility', label: 'Visibility' },
        { value: 'benchmark', label: 'Benchmark' },
        { value: 'personal', label: 'Personal' },
    ];

    const displayLimitOptions = [
        { value: '10', label: 'Show 10' },
        { value: '20', label: 'Show 20' },
        { value: '50', label: 'Show 50' },
        { value: 'all', label: 'Show All' },
    ];

    const sortOptions = [
        { value: 'position', label: 'Best Position' },
        { value: 'question', label: 'Question Text' },
        { value: 'model', label: 'AI Model' },
        { value: 'mentions', label: 'Total Mentions' },
    ];

    // Process and filter data
    const processedQuestions = useMemo(() => {
        if (!data?.topQuestions) return [];

        let questions = [...data.topQuestions];

        // Filter by question type
        if (questionTypeFilter !== 'all') {
            questions = questions.filter(q => q.type === questionTypeFilter);
        }

        // Filter by AI model (this should already be handled by the dashboard context)
        // But we can add additional client-side filtering if needed

        // Sort questions
        questions.sort((a, b) => {
            let aValue: number | string;
            let bValue: number | string;

            switch (sortBy) {
                case 'position':
                    aValue = a.bestPosition;
                    bValue = b.bestPosition;
                    break;
                case 'question':
                    aValue = a.question.toLowerCase();
                    bValue = b.question.toLowerCase();
                    break;
                case 'model':
                    aValue = a.bestResponseModel.toLowerCase();
                    bValue = b.bestResponseModel.toLowerCase();
                    break;
                case 'mentions':
                    aValue = a.totalMentions;
                    bValue = b.totalMentions;
                    break;
                default:
                    aValue = a.bestPosition;
                    bValue = b.bestPosition;
            }

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            }

            const numA = Number(aValue);
            const numB = Number(bValue);
            return sortDirection === 'asc' ? numA - numB : numB - numA;
        });

        // Apply display limit
        if (displayLimit !== 0) {
            questions = questions.slice(0, displayLimit);
        }

        return questions;
    }, [data?.topQuestions, questionTypeFilter, sortBy, sortDirection, displayLimit]);

    const handleGenerateReport = async () => {
        if (!selectedCompany) return;

        setIsGenerating(true);
        setGenerationStatus('Analyzing competitor landscape...');
        try {
            // Step 1: Generate competitors if needed
            const exampleCompetitor = selectedCompany.competitors[0]?.name;
            if (!exampleCompetitor) {
                setGenerationStatus('Error: Add one competitor to seed the list.');
                setIsGenerating(false);
                return;
            }

            await generateCompetitors(selectedCompany.id, exampleCompetitor);

            // Step 2: Trigger report generation
            setGenerationStatus('Initializing report generation pipeline...');
            await triggerReportGeneration(selectedCompany.id);
        } catch (error) {
            console.error("Failed to start report generation:", error);
            setIsGenerating(false);
            setGenerationStatus('Failed to start report generation.');
        }
    };

    const handleRefresh = async () => {
        await refreshData();
    };

    const handleSort = (newSortBy: typeof sortBy) => {
        if (sortBy === newSortBy) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(newSortBy);
            setSortDirection(newSortBy === 'question' || newSortBy === 'model' ? 'asc' : 'desc');
        }
    };

    if (!hasExistingData) {
        return (
            <div className="h-full flex flex-col">
                <WelcomePrompt
                    onGenerateReport={handleGenerateReport}
                    isGenerating={isGenerating}
                    generationStatus={generationStatus}
                />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header Section - Consistent with other pages */}
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
                        label="Question Type"
                        value={questionTypeFilter}
                        options={questionTypeOptions}
                        onChange={(value) => setQuestionTypeFilter(value)}
                        icon={Filter}
                        disabled={loading || refreshing}
                    />
                    <FilterDropdown
                        label="Show"
                        value={displayLimit === 0 ? 'all' : displayLimit.toString()}
                        options={displayLimitOptions}
                        onChange={(value) => setDisplayLimit(value === 'all' ? 0 : parseInt(value))}
                        icon={MessageSquare}
                        disabled={loading || refreshing}
                    />
                    <FilterDropdown
                        label="Sort by"
                        value={sortBy}
                        options={sortOptions}
                        onChange={(value) => handleSort(value as typeof sortBy)}
                        icon={ArrowUpDown}
                        disabled={loading || refreshing}
                    />
                    <FilterDropdown
                        label="AI Model"
                        value={filters.aiModel}
                        options={aiModelOptions}
                        onChange={(value) => updateFilters({ aiModel: value as DashboardFilters['aiModel'] })}
                        icon={filters.aiModel === 'all' ? Sparkles : undefined}
                        disabled={loading || refreshing}
                    />
                    <button 
                        onClick={handleRefresh}
                        disabled={loading || refreshing}
                        className="flex items-center justify-center w-full md:w-auto gap-2 px-4 py-2 bg-[#7762ff] text-white rounded-lg hover:bg-[#6650e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium col-span-2 sm:col-span-1"
                    >
                        {refreshing ? (
                            <>
                                <Loader size={16} className="animate-spin" />
                                <span className="whitespace-nowrap">Refreshing...</span>
                            </>
                        ) : (
                            <>
                                <RefreshCw size={16} />
                                <span className="whitespace-nowrap">Refresh data</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 p-1">
                <div className="h-full w-full">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="flex flex-col items-center space-y-4">
                                <Loader className="w-8 h-8 animate-spin text-[#7762ff]" />
                                <p className="text-gray-600">Loading response data...</p>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full overflow-y-auto">
                            {/* Removed Stats Summary cards */}

                            {/* Response Cards Grid */}
                            {processedQuestions.length === 0 ? (
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
                                    {processedQuestions.map((question, index) => (
                                        <ResponseItem
                                            key={question.id}
                                            question={question}
                                            index={index}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResponseDetailsPage; 