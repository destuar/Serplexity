import React, { useState } from 'react';
import Card from '../ui/Card';
import { useDashboard } from '../../hooks/useDashboard';
import { useCompany } from '../../contexts/CompanyContext';
import { TopRankingQuestion } from '../../services/companyService';
import { getModelDisplayName } from '../../types/dashboard';

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
    // Get company name from the selected company context
    const companyName = selectedCompany?.name;
    
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
        if (!companyName || !text) return text;

        // Create case-insensitive regex for the brand name
        const brandRegex = new RegExp(`(${companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const parts = text.split(brandRegex);

        return (
            <>
                {parts.map((part, index) => {
                    if (part.toLowerCase() === companyName.toLowerCase()) {
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
        <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-800 leading-relaxed">
                {renderFormattedText(text)}
            </p>
        </div>
    );
};

interface TooltipProps {
  question: TopRankingQuestion;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ question, children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  // Using centralized model display name function
  const formatModelName = (model: string) => {
    return getModelDisplayName(model);
  };

  // Calculate positioning to prevent going off-screen with extra space
  const getTooltipStyle = () => {
    const tooltipWidth = 900;
    const margin = 48; // Large margin from screen edge for extra space
    const halfWidth = tooltipWidth / 2;
    
    // Check if tooltip would extend beyond left edge
    const wouldGoOffLeft = position.x - halfWidth < margin;
    
    let transform = 'translate(-50%, -100%)';
    let left = position.x;
    let arrowLeft = '50%';
    
    if (wouldGoOffLeft) {
      // Position tooltip so its left edge is at the margin
      left = margin + halfWidth;
      transform = 'translate(-50%, -100%)';
      // Adjust arrow position to point to the original hover point
      const arrowOffset = ((position.x - margin) / tooltipWidth) * 100;
      arrowLeft = Math.max(8, Math.min(92, arrowOffset)) + '%'; // Keep arrow within tooltip bounds
    }
    
    return {
      left: `${left}px`,
      top: `${position.y}px`,
      transform,
      arrowLeft,
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    };
  };

  const tooltipStyle = getTooltipStyle();

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && (
        <div
          className="fixed z-50 bg-white border border-gray-200 shadow-2xl rounded-xl p-6 w-[900px] max-w-[95vw] transition-all duration-200 ease-out"
          style={{
            left: tooltipStyle.left,
            top: tooltipStyle.top,
            transform: tooltipStyle.transform,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-[#7762ff] rounded-full"></div>
                <h4 className="font-semibold text-sm text-gray-600 uppercase tracking-wide">Question</h4>
              </div>
              <p className="text-base text-gray-900 leading-relaxed font-medium">
                {question.question}
              </p>
            </div>
            
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <h4 className="font-semibold text-sm text-gray-600 uppercase tracking-wide">Best Response</h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-[#7762ff]/10 text-[#7762ff] px-3 py-1 rounded-full text-xs font-medium border border-[#7762ff]/20">
                    {formatModelName(question.bestResponseModel)}
                  </span>
                </div>
              </div>
              <FormattedResponseViewer text={stripBrandTags(question.bestResponse)} />
            </div>

            {question.productName && (
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-500">Product:</span>
                <span className="bg-[#7762ff]/10 text-[#7762ff] px-2 py-1 rounded-md text-xs font-medium border border-[#7762ff]/20">
                  {question.productName}
                </span>
              </div>
            )}
          </div>
          
          {/* Arrow pointing down with dynamic positioning */}
          <div 
            className="absolute bottom-0 transform -translate-x-1/2 translate-y-full"
            style={{ left: tooltipStyle.arrowLeft }}
          >
            <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[8px] border-transparent border-t-white"></div>
            <div className="absolute top-[-9px] left-1/2 transform -translate-x-1/2">
              <div className="w-0 h-0 border-l-[9px] border-r-[9px] border-t-[9px] border-transparent border-t-gray-200"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TopRankingQuestionsCard = () => {
  const { data, loading, error } = useDashboard();

  const questions = data?.topQuestions || [];
  
  // Debug logging to understand the data structure
  console.log('[TopRankingQuestionsCard] Raw data:', data);
  console.log('[TopRankingQuestionsCard] Top questions:', questions);
  console.log('[TopRankingQuestionsCard] First question structure:', questions[0]);

  if (loading) {
    return (
      <Card className="h-full">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Ranking Questions</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Ranking Questions</h3>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      </Card>
    );
  }

  if (!questions.length) {
    return (
      <Card className="h-full">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Ranking Questions</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 text-sm font-medium">Your company did not appear in this model's search results</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Top Ranking Questions</h3>
      </div>
      
      <div className="flex-1 space-y-2 mb-1">
        {questions.slice(0, 4).map((question, index) => (
          <Tooltip key={question.id} question={question}>
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
              <div className="flex-shrink-0">
                <span className="text-sm font-medium text-gray-700 w-6">#{index + 1}</span>
              </div>
              
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-sm text-gray-700 truncate">
                  {question.question}
                </p>
              </div>
              
              <div className="flex items-center gap-1 flex-shrink-0 text-xs text-gray-500">
                <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs font-medium">
                  {question.type}
                </span>
              </div>
            </div>
          </Tooltip>
        ))}
      </div>
    </Card>
  );
};

export default TopRankingQuestionsCard; 