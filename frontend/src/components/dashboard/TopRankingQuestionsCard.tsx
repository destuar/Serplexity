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
import { Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "../../hooks/useDashboard";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import LiquidGlassCard from "../ui/LiquidGlassCard";
import Tooltip from "../ui/Tooltip";

const TopRankingQuestionsCard = () => {
  const { data, loading: _loading, error } = useDashboard();
  const navigate = useNavigate();
  const isTallerScreen = useMediaQuery("(min-height: 900px)");

  const questions = data?.topQuestions || [];

  const handleQuestionClick = (id: string) => {
    navigate(`/prompts?openQuestion=${id}`);
  };

  if (error) {
    return (
      <LiquidGlassCard className="h-full">
        <div className="flex items-baseline gap-0.5 mb-4">
          <h3 className="text-sm font-medium text-gray-900">
            Top Ranking Questions
          </h3>
          <Tooltip
            content={
              <span>
                <strong>Top Ranking Questions</strong>: questions where your
                brand ranks highly or is most frequently included in AI answers.
                Prioritize these for reinforcement and use them to identify
                topics where you already win.
              </span>
            }
          >
            <span
              aria-label="What this metric means"
              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/40 bg-white/70 text-gray-700 align-super -translate-y-0.5 md:-translate-y-1"
            >
              <Info className="h-3 w-3" />
            </span>
          </Tooltip>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      </LiquidGlassCard>
    );
  }

  if (!questions.length) {
    return (
      <LiquidGlassCard className="h-full">
        <div className="flex items-baseline gap-0.5 mb-4">
          <h3 className="text-sm font-medium text-gray-900">
            Top Ranking Questions
          </h3>
          <Tooltip
            content={
              <span>
                <strong>Top Ranking Questions</strong>: questions where your
                brand ranks highly or is most frequently included in AI answers.
                Prioritize these for reinforcement and use them to identify
                topics where you already win.
              </span>
            }
          >
            <span
              aria-label="What this metric means"
              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/40 bg-white/70 text-gray-700 align-super -translate-y-0.5 md:-translate-y-1"
            >
              <Info className="h-3 w-3" />
            </span>
          </Tooltip>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 text-sm font-medium">
              Your company did not appear in this model's search results
            </p>
          </div>
        </div>
      </LiquidGlassCard>
    );
  }

  return (
    <LiquidGlassCard className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-0.5">
          <h3 className="text-sm font-medium text-gray-900">
            Top Ranking Questions
          </h3>
          <Tooltip
            content={
              <span>
                <strong>Top Ranking Questions</strong>: questions where your
                brand ranks highly or is most frequently included in AI answers.
                Prioritize these for reinforcement and use them to identify
                topics where you already win.
              </span>
            }
          >
            <span
              aria-label="What this metric means"
              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/40 bg-white/70 text-gray-700 align-super -translate-y-0.5 md:-translate-y-1"
            >
              <Info className="h-3 w-3" />
            </span>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 space-y-2 mb-1">
        {questions.slice(0, isTallerScreen ? 5 : 4).map((question, index) => (
          <div
            key={question.id}
            className="flex items-center gap-2 p-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md transition-colors cursor-pointer hover:bg-white/85"
            onClick={() => handleQuestionClick(question.id)}
          >
            <div className="flex-shrink-0">
              <span className="text-sm font-medium text-gray-700 w-6">
                #{index + 1}
              </span>
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
