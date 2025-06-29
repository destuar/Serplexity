import React from 'react';
import MockDashboardLayout from '../MockDashboardLayout';
import MockAiVisibilitySummaryCard from '../cards/MockAiVisibilitySummaryCard';
import MockOptimizationChecklistCard from '../cards/MockOptimizationChecklistCard';

const MockVisibilityReportPage: React.FC = () => {
  return (
    <MockDashboardLayout activePage="Visibility Report">
      <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visibility Report</h1>
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