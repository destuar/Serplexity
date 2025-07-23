/**
 * @file TopRankingQuestionsCard.tsx
 * @description This component displays a list of top-ranking questions for the selected company.
 * It fetches question data from the `useDashboard` hook and allows users to navigate to a detailed
 * response page for each question. It handles loading, error, and no-data states. This card is crucial
 * for identifying key questions where the company has strong AI visibility.
 *
 * @dependencies
 * - react-router-dom: For navigation (`useNavigate`).
 * - ../ui/Card: Generic card component for consistent UI.
 * - ../../hooks/useDashboard: Custom hook for accessing dashboard data.
 * - ../../hooks/useMediaQuery: Custom hook for media queries.
 *
 * @exports
 * - TopRankingQuestionsCard: React functional component for displaying top-ranking questions.
 */
import { useNavigate } from 'react-router-dom';
import LiquidGlassCard from '../ui/LiquidGlassCard';
import { useDashboard } from '../../hooks/useDashboard';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const TopRankingQuestionsCard = () => {
  const { data, loading: _loading, error } = useDashboard();
  const navigate = useNavigate();
  const isTallerScreen = useMediaQuery('(min-height: 900px)');

  const questions = data?.topQuestions || [];

  const handleQuestionClick = (id: string) => {
    navigate(`/response-details?questionId=${id}`);
  };

  if (error) {
    return (
      <LiquidGlassCard className="h-full">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Ranking Questions</h3>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      </LiquidGlassCard>
    );
  }

  if (!questions.length) {
    return (
      <LiquidGlassCard className="h-full">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Ranking Questions</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 text-sm font-medium">Your company did not appear in this model's search results</p>
          </div>
        </div>
      </LiquidGlassCard>
    );
  }

  return (
    <LiquidGlassCard className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Top Ranking Questions</h3>
      </div>
      
      <div className="flex-1 space-y-2 mb-1">
        {questions.slice(0, isTallerScreen ? 5 : 4).map((question, index) => (
            <div 
              key={question.id}
              className="flex items-center gap-2 p-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md transition-colors cursor-pointer hover:bg-white/85"
              onClick={() => handleQuestionClick(question.id)}
            >
              <div className="flex-shrink-0">
                <span className="text-sm font-medium text-gray-700 w-6">#{index + 1}</span>
              </div>
              
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-sm text-gray-700 truncate">
                  {question.question}
                </p>
              </div>
              
              <div className="flex items-center gap-1 flex-shrink-0 text-xs text-gray-500">
                <span className="text-gray-500 text-xs font-medium">
                  {question.type}
                </span>
              </div>
            </div>
        ))}
      </div>
    </LiquidGlassCard>
  );
};

export default TopRankingQuestionsCard; 