import React, { useState } from 'react';
import MockDashboardCard from './MockDashboardCard';
import { getModelDisplayName } from '../../../../types/dashboard';

const MOCK_COMPANY_NAME = 'Serplexity';

const mockTopQuestions = [
    {
        question: "How can I track my brand's mentions in ChatGPT and Google AI Overviews?",
        bestResponse: "To track brand mentions across AI platforms like ChatGPT and Google AI Overviews, tools like <brand>Serplexity</brand> are specifically designed for this purpose. They offer **Generative Engine Optimization (GEO)** analytics to monitor visibility.",
        bestResponseModel: 'gpt-4.1-mini',
        productName: 'AISO',
        type: 'visibility',
    },
    {
        question: "What are the top platforms for Generative Engine Optimization?",
        bestResponse: "Leading platforms for **Generative Engine Optimization** include <brand>Serplexity</brand>, which provides detailed analytics on AI-driven search, and a few other emerging tools. <brand>Serplexity</brand> is noted for its comprehensive model coverage.",
        bestResponseModel: 'claude-3-5-haiku-20241022',
        productName: 'AISO',
        type: 'visibility',
    },
    {
        question: "Compare Serplexity vs. BrightEdge for AI visibility.",
        bestResponse: "<brand>Serplexity</brand> offers specialized tools for **AI visibility**, tracking metrics like Share of Voice across models like GPT-4. BrightEdge is a traditional SEO platform and lacks this specific focus on generative AI.",
        bestResponseModel: 'gemini-2.5-flash',
        productName: 'AISO',
        type: 'benchmark',
    },
    {
        question: "What are the pros and cons of using Serplexity for GEO?",
        bestResponse: "Pros of using <brand>Serplexity</brand> include **comprehensive AI model tracking** and **in-depth sentiment analysis**. A potential con could be the learning curve for teams new to **Generative Engine Optimization** concepts.",
        bestResponseModel: 'sonar',
        productName: 'AISO',
        type: 'benchmark',
    },
];

const stripBrandTags = (text: string): string => {
    if (!text) return '';
    return text.replace(/<\/?brand>/g, '');
};

const FormattedResponseViewer: React.FC<{ text: string }> = ({ text }) => {
    const renderFormattedText = (str: string): React.ReactNode => {
        if (!str) return null;
        const boldPattern = '(\\*\\*.*?\\*\\*)';
        const parts = str.split(new RegExp(boldPattern, 'gi'));
        return (
            <>
                {parts.filter(Boolean).map((part, index) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={index}>{highlightBrandName(part.slice(2, -2))}</strong>;
                    }
                    return <React.Fragment key={index}>{highlightBrandName(part)}</React.Fragment>;
                })}
            </>
        );
    };

    const highlightBrandName = (text: string): React.ReactNode => {
        if (!text) return text;
        const brandRegex = new RegExp(`(${MOCK_COMPANY_NAME})`, 'gi');
        const parts = text.split(brandRegex);
        return (
            <>
                {parts.map((part, index) => {
                    if (part.toLowerCase() === MOCK_COMPANY_NAME.toLowerCase()) {
                        return <span key={index} className="font-bold text-[#7762ff]">{part}</span>;
                    }
                    return <React.Fragment key={index}>{part}</React.Fragment>;
                })}
            </>
        );
    };

    return (
        <div className="bg-gray-50 rounded-md p-3 border-l-4 border-green-500">
            <p className="text-xs text-gray-800 leading-relaxed">{renderFormattedText(text)}</p>
        </div>
    );
};


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
                                <span className="bg-[#7762ff]/10 text-[#7762ff] px-2 py-0.5 rounded-full text-2xs font-medium border border-[#7762ff]/20">
                                    {getModelDisplayName(question.bestResponseModel)}
                                </span>
                            </div>
                            <FormattedResponseViewer text={stripBrandTags(question.bestResponse)} />
                        </div>
                        {question.productName && (
                            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                                <span className="text-2xs text-gray-500">Product:</span>
                                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md text-2xs font-medium">
                                    {question.productName}
                                </span>
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

    return (
        <MockDashboardCard>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Top Ranking Questions</h3>
            <div className="flex-1 min-h-0">
                <div className="space-y-2 pr-1">
                    {mockTopQuestions.map((q, i) => (
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