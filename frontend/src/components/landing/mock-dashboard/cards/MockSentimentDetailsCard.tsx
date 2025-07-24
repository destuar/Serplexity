/**
 * @file MockSentimentDetailsCard.tsx
 * @description This component displays detailed sentiment analysis for the brand, breaking down sentiment
 * scores by various categories (e.g., Quality, Price, Reputation). It provides a textual summary of
 * the brand's sentiment strengths and weaknesses, along with individual category scores. This card is
 * used to demonstrate the application's in-depth sentiment analysis capabilities on the landing page.
 *
 * @dependencies
 * - react: For core React functionalities.
 * - ./MockDashboardCard: Generic card component for consistent UI in the mock dashboard.
 *
 * @exports
 * - MockSentimentDetailsCard: React functional component for displaying mock sentiment details.
 */
import React from 'react';
import MockDashboardCard from './MockDashboardCard';

const mockReportMetric = {
    sentimentDetails: {
        "Quality": { score: 9.5 },
        "Price": { score: 9.0 },
        "Reputation": { score: 7.9 },
        "Trust": { score: 9.3 },
        "Service": { score: 8.6 },
    },
    sentimentScore: 8.9
};

const MOCK_COMPANY_PROFILE = {
    name: 'Serplexity'
};

const getScoreColor = (score: number) => {
    return 'text-black bg-white shadow-md';
};

const getScoreTextColor = (score: number) => {
    if (score >= 8.5) return 'text-green-700';
    if (score >= 7.0) return 'text-yellow-700';
    return 'text-red-700';
};

const MockSentimentDetailsCard: React.FC = () => {
    const { sentimentDetails } = mockReportMetric;
    const categories = Object.entries(sentimentDetails);
    
    const highestCat = [...categories].sort((a, b) => b[1].score - a[1].score)[0];
    const lowestCat = [...categories].sort((a, b) => a[1].score - b[1].score)[0];

    const categoryScores = categories.map(([, { score }]) => score);
    const averageScore = categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length;

  return (
    <MockDashboardCard className="p-0">
      <div className="h-full flex min-w-0">
          <div className="flex-[3] p-4 flex flex-col min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Sentiment Details</h3>
              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                <p className="text-base text-gray-700 leading-relaxed break-words pr-2 pl-4">
                    With an impressive overall sentiment score of {averageScore.toFixed(1)}/10, {MOCK_COMPANY_PROFILE.name} is perceived very positively. The brand's key strength lies in its {highestCat[0]}, with a score of {highestCat[1].score.toFixed(1)}, indicating exceptional user satisfaction. The primary area for improvement is {lowestCat[0]} ({lowestCat[1].score.toFixed(1)}). Focusing on enhancing brand messaging and public relations around this attribute could elevate overall perception even further, aligning it with the brand's top-performing areas.
                </p>
              </div>
          </div>
          <div className="flex-[2] p-6 flex items-center min-w-0">
            <div className="flex flex-wrap gap-3 w-full">
                {categories.map(([name, { score }]) => (
                    <div key={name} className={`flex-[0_0_calc(50%-6px)] rounded-lg p-2 ${getScoreColor(score)}`}>
                        <div className="text-xs font-semibold mb-1 leading-tight uppercase tracking-wide">{name}</div>
                        <div className="text-sm font-bold flex items-center">
                            <span className={getScoreTextColor(score)}>{score.toFixed(1)}</span>
                            <span className="text-xs font-medium opacity-70 text-black">/10</span>
                        </div>
                    </div>
                ))}
                <div className={`flex-[0_0_calc(50%-6px)] rounded-lg p-2 ${getScoreColor(averageScore)}`}>
                    <div className="text-xs font-semibold mb-1 leading-tight uppercase tracking-wide">Average Score</div>
                    <div className="text-sm font-bold flex items-center">
                        <span className={getScoreTextColor(averageScore)}>{averageScore.toFixed(1)}</span>
                        <span className="text-xs font-medium opacity-70 text-black">/10</span>
                    </div>
                </div>
            </div>
          </div>
      </div>
    </MockDashboardCard>
  );
};

export default MockSentimentDetailsCard; 