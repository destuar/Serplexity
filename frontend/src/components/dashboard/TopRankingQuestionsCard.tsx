import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../ui/Card';
import { useDashboard } from '../../hooks/useDashboard';
import { TopRankingQuestion } from '../../services/companyService';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const TopRankingQuestionsCard = () => {
  const { data, loading, error } = useDashboard();
  const navigate = useNavigate();
  const isTallerScreen = useMediaQuery('(min-height: 900px)');

  const questions = data?.topQuestions || [];

  const handleQuestionClick = (id: string) => {
    navigate(`/response-details?questionId=${id}`);
  };

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
        {questions.slice(0, isTallerScreen ? 5 : 4).map((question, index) => (
            <div 
              key={question.id}
              className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg transition-colors cursor-pointer"
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
                <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs font-medium">
                  {question.type}
                </span>
              </div>
            </div>
        ))}
      </div>
    </Card>
  );
};

export default TopRankingQuestionsCard; 