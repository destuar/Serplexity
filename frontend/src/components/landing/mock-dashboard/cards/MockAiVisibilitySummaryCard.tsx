/**
 * @file MockAiVisibilitySummaryCard.tsx
 * @description This component displays a mock AI-generated visibility summary for the selected company.
 * It provides a quick, AI-driven overview of the company's visibility performance, using static mock data.
 * This card is used within the landing page's dashboard preview to demonstrate AI summary capabilities.
 *
 * @dependencies
 * - react: For core React functionalities.
 * - ./MockDashboardCard: Generic card component for consistent UI in the mock dashboard.
 *
 * @exports
 * - MockAiVisibilitySummaryCard: React functional component for displaying the mock AI visibility summary.
 */
import React from 'react';
import MockDashboardCard from './MockDashboardCard';

const mockVisibilityReportData = {
    summary: "Based on the latest data, **Serplexity** shows strong visibility with an average inclusion rate of **72.3%** and a Share of Voice of **38.5%**. The brand excels in **Quality** and **Trust**, with sentiment scores of **9.2** and **8.9** respectively. However, there is an opportunity to improve the **Reputation** score (currently **7.5**). Key areas for optimization include targeting long-tail keywords where competitors are more visible and improving on-page structure for better LLM parsing."
};

const MockAiVisibilitySummaryCard: React.FC = () => {
  const summaryText = mockVisibilityReportData.summary.replace(/\*\*/g, '').replace(/\*/g, '');
  
  return (
    <MockDashboardCard className="p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex-shrink-0">AI Visibility Summary</h3>
      <div className="flex-1 overflow-y-auto">
        <p className="text-gray-700 whitespace-pre-wrap">{summaryText}</p>
      </div>
    </MockDashboardCard>
  );
};

export default MockAiVisibilitySummaryCard;