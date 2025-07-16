/**
 * @file MockVisibilityReportPage.tsx
 * @description This component renders a mock progress report page for the dashboard preview.
 * It displays an AI-generated visibility summary and an optimization checklist, simulating
 * a report that provides actionable insights for improving AI visibility. This page is designed
 * to showcase the application's reporting capabilities on the landing page.
 *
 * @dependencies
 * - react: For core React functionalities.
 * - ../MockDashboardLayout: The layout component for the mock dashboard.
 * - ../cards/MockAiVisibilitySummaryCard: Mock card component for displaying an AI visibility summary.
 * - ../cards/MockOptimizationChecklistCard: Mock card component for displaying an optimization checklist.
 *
 * @exports
 * - MockVisibilityReportPage: The React functional component for the mock visibility report page.
 */
import React from 'react';
import MockDashboardLayout from '../MockDashboardLayout';
import MockAiVisibilitySummaryCard from '../cards/MockAiVisibilitySummaryCard';
import MockOptimizationChecklistCard from '../cards/MockOptimizationChecklistCard';

const MockVisibilityReportPage: React.FC = () => {
  return (
    <MockDashboardLayout activePage="Progress Report">
      <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Progress Report</h1>
          <p className="text-sm text-gray-500 mt-1">
            Last updated: 6/29/2025, 9:00:00 AM
          </p>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col gap-4">
        <div className="min-h-0" style={{ flex: '1 1 30%' }}>
          <MockAiVisibilitySummaryCard />
        </div>
        <div className="min-h-0" style={{ flex: '1 1 70%' }}>
          <MockOptimizationChecklistCard />
        </div>
      </div>
    </MockDashboardLayout>
  );
};

export default MockVisibilityReportPage; 