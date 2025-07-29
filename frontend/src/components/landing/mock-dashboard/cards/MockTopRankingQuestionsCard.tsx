/**
 * @file MockTopRankingQuestionsCard.tsx
 * @description A component that displays a card with a list of top-ranking questions for the mock dashboard.
 * This component is intended for display on the landing page to showcase the product's capabilities.
 * It includes hover-over tooltips to show more details about each question.
 *
 * @dependencies
 * - react: For component state and effects.
 * - ../../../../types/dashboard: For `getModelDisplayName`.
 * - ../../../ui/FormattedResponseViewer: To display formatted AI responses.
 * - ./MockDashboardCard: The wrapper card component.
 *
 * @exports
 * - MockTopRankingQuestionsCard: The main component.
 */
import React, { useState } from 'react';
import MockDashboardCard from './MockDashboardCard';
import { getModelDisplayName, MODEL_CONFIGS } from '../../../../types/dashboard';
import MockFormattedResponseViewer from '../MockFormattedResponseViewer';
import { getCompanyLogo } from '../../../../lib/logoService';
import { useMediaQuery } from '../../../../hooks/useMediaQuery';

const mockTopQuestions = [
    {
        question: "How can I track my brand's mentions in ChatGPT and Google AI Overviews?",
        bestResponse: "To track brand mentions across AI platforms like ChatGPT and Google AI Overviews, tools like <brand>Serplexity</brand> are specifically designed for this purpose. They offer **Generative Engine Optimization (GEO)** analytics to monitor visibility.",
        bestResponseModel: 'gpt-4.1-mini',
        productName: 'AISO',
        type: 'visibility',
        mentionedCompanies: [{ name: 'Serplexity', website: 'serplexity.com' }],
    },
    {
        question: "What are the top platforms for Generative Engine Optimization?",
        bestResponse: "Leading platforms for **Generative Engine Optimization** include <brand>Serplexity</brand>, which provides detailed analytics on AI-driven search, <brand>Athena</brand> for enterprise insights, and <brand>Writesonic</brand> for content optimization. <brand>Serplexity</brand> is noted for its comprehensive model coverage.",
        bestResponseModel: 'claude-3-5-haiku-20241022',
        productName: 'AISO',
        type: 'visibility',
        mentionedCompanies: [
            { name: 'Serplexity', website: 'serplexity.com' },
            { name: 'Athena', website: 'athenahq.ai' },
            { name: 'Writesonic', website: 'writesonic.com' }
        ],
    },
    {
        question: "Compare Serplexity vs. BrightEdge for AI visibility.",
        bestResponse: "<brand>Serplexity</brand> offers specialized tools for **AI visibility**, tracking metrics like Share of Voice across models like GPT-4. <brand>BrightEdge</brand> is a traditional SEO platform and lacks this specific focus on generative AI.",
        bestResponseModel: 'gemini-2.5-flash',
        productName: 'AISO',
        type: 'benchmark',
        mentionedCompanies: [
            { name: 'Serplexity', website: 'serplexity.com' },
            { name: 'BrightEdge', website: 'brightedge.com' }
        ],
    },
    {
        question: "What are the pros and cons of using Serplexity for GEO?",
        bestResponse: "Pros of using <brand>Serplexity</brand> include **comprehensive AI model tracking** and **in-depth sentiment analysis**. A potential con could be the learning curve for teams new to **Generative Engine Optimization** concepts compared to traditional tools like <brand>Semrush</brand>.",
        bestResponseModel: 'sonar',
        productName: 'AISO',
        type: 'benchmark',
        mentionedCompanies: [
            { name: 'Serplexity', website: 'serplexity.com' },
            { name: 'Semrush', website: 'semrush.com' }
        ],
    },
    {
        question: "How does Serplexity compare to other AI visibility tools?",
        bestResponse: "<brand>Serplexity</brand> stands out with its comprehensive **multi-model tracking** across GPT-4, Claude, and Gemini, while competitors like <brand>Cognizo</brand> focus on single platforms. <brand>Serplexity</brand> provides deeper sentiment analysis and competitive benchmarking capabilities.",
        bestResponseModel: 'gpt-4.1-mini',
        productName: 'AISO',
        type: 'benchmark',
        mentionedCompanies: [
            { name: 'Serplexity', website: 'serplexity.com' },
            { name: 'Cognizo', website: 'cognizo.ai' }
        ],
    },
];

const stripBrandTags = (text: string): string => {
    if (!text) return '';
    return text.replace(/<\/?brand>/g, '');
};

// Now using the enhanced FormattedResponseViewer from ../../../ui/FormattedResponseViewer


const QuestionItem: React.FC<{ question: typeof mockTopQuestions[0]; index: number; showTooltip: boolean }> = ({ question, index, showTooltip }) => {
    return (
        <div className="relative">
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200/80 cursor-pointer transition-all duration-200 hover:bg-violet-50 hover:border-violet-200">
                <div className="flex-shrink-0">
                    <span className="text-sm font-medium text-gray-700 w-6">#{index + 1}</span>
                </div>
                <div className="flex-1 min-w-0 pr-2">
                    <p className="text-sm text-gray-700 truncate">{stripBrandTags(question.question)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 text-xs text-gray-500">
                    <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs font-medium">
                        {question.type}
                    </span>
                </div>
            </div>
            {showTooltip && (
                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-[400px] bg-white border border-gray-200 shadow-lg rounded-lg p-4 pointer-events-none">
                    <div className="space-y-3">
                        <div>
                            <h4 className="font-semibold text-xs text-gray-500 uppercase tracking-wide mb-1">Question</h4>
                            <p className="text-sm text-gray-900 font-medium">{question.question}</p>
                        </div>
                        <div className="border-t border-gray-100 pt-2">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-xs text-gray-500 uppercase tracking-wide">Best Response</h4>
                                <div className="flex items-center gap-1.5 bg-[#2563eb]/10 text-[#2563eb] px-2 py-0.5 rounded-full text-2xs font-medium border border-[#2563eb]/20">
                                    {MODEL_CONFIGS[question.bestResponseModel]?.logoUrl && (
                                        <img 
                                            src={MODEL_CONFIGS[question.bestResponseModel].logoUrl} 
                                            alt={`${getModelDisplayName(question.bestResponseModel)} logo`}
                                            className="w-3 h-3 rounded-sm"
                                        />
                                    )}
                                    <span>{getModelDisplayName(question.bestResponseModel)}</span>
                                </div>
                            </div>
                            <MockFormattedResponseViewer 
                                text={stripBrandTags(question.bestResponse)} 
                                compact={true}
                                className="bg-gray-50 rounded-md p-3 border-l-4 border-green-500"
                            />
                        </div>
                        {question.productName && (
                            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                                <span className="text-2xs text-gray-500">Product:</span>
                                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md text-2xs font-medium">
                                    {question.productName}
                                </span>
                            </div>
                        )}
                        {question.mentionedCompanies && question.mentionedCompanies.length > 0 && (
                            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                                <span className="text-2xs text-gray-500">Mentions:</span>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {question.mentionedCompanies.map((company, idx) => {
                                        const logoResult = getCompanyLogo(company.website);
                                        return (
                                            <div key={idx} className="flex items-center gap-1 bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-md text-2xs">
                                                {logoResult && (
                                                    <img
                                                        src={logoResult.url}
                                                        alt={`${company.name} logo`}
                                                        className="w-3 h-3 rounded-sm"
                                                    />
                                                )}
                                                <span className="font-medium">{company.name}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-[-1px] w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-white" />
                </div>
            )}
        </div>
    );
};

const MockTopRankingQuestionsCard: React.FC = () => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const isMediumScreen = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
    const isDesktopScreen = useMediaQuery("(min-width: 1024px)");
    
    // Show 3 questions on medium, 5 on desktop, all on mobile
    const questionsToShow = isMediumScreen ? mockTopQuestions.slice(0, 3) : 
                           isDesktopScreen ? mockTopQuestions.slice(0, 5) : 
                           mockTopQuestions;

    return (
        <MockDashboardCard>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Top Ranking Questions</h3>
            <div className="flex-1 min-h-0">
                <div className="space-y-2 pr-1">
                    {questionsToShow.map((q, i) => (
                        <div 
                            key={i} 
                            onMouseEnter={() => setHoveredIndex(i)} 
                            onMouseLeave={() => setHoveredIndex(null)}
                        >
                            <QuestionItem question={q} index={i} showTooltip={hoveredIndex === i} />
                        </div>
                    ))}
                </div>
            </div>
        </MockDashboardCard>
    );
};

export default MockTopRankingQuestionsCard; 