/**
 * @file MockOptimizationChecklistCard.tsx
 * @description This component displays a mock optimization checklist for improving AI visibility.
 * It presents a list of actionable items, some marked as completed and others pending, to simulate
 * a progress tracker for SEO and GEO efforts. This card is used within the landing page's dashboard
 * preview to demonstrate the application's guidance features.
 *
 * @dependencies
 * - react: For core React functionalities.
 * - ./MockDashboardCard: Generic card component for consistent UI in the mock dashboard.
 * - ../../../../lib/utils: For the `cn` utility function to conditionally join CSS class names.
 *
 * @exports
 * - MockOptimizationChecklistCard: React functional component for displaying the mock optimization checklist.
 */
import React from 'react';
import MockDashboardCard from './MockDashboardCard';
import { cn } from '../../../../lib/utils';

const mockVisibilityReportData = {
    checklist: [
        { text: "Update XML sitemap to include all dashboard sub-routes and submit to AI publisher consoles.", completed: true },
        { text: "Remove blanket Disallow rule for /experimental/ in robots.txt to allow crawler access.", completed: true },
        { text: "Implement `Dataset` and `FAQ` schema markup on key product and dashboard pages.", completed: true },
        { text: "Perform an entity alignment audit for H1/H2 tags and internal link anchors.", completed: true },
        { text: "Set up server-side logging to monitor for `LLM Referer` headers to track AI-driven traffic.", completed: true },
        { text: "Publish the first article in the 'AI Visibility Benchmarks' content series.", completed: false },
        { text: "Secure 5 new high-authority backlinks with contextual anchors like 'AI citation rankings'.", completed: false },
        { text: "Generate `HowTo` schema for all onboarding video tutorials.", completed: false },
        { text: "Commission a long-form case study (>3,000 words) featuring a key enterprise client.", completed: false },
        { text: "Create an evergreen 'Glossary of AI Visibility Terms' with `ItemList` schema.", completed: false },
        { text: "Launch guest post campaign targeting 3 niche AI-focused publications.", completed: false },
        { text: "Implement `hreflang` tags for `en-US` and `en-GB` across all marketing pages.", completed: false },
    ]
};

const MockOptimizationChecklistCard: React.FC = () => {
    const completedCount = mockVisibilityReportData.checklist.filter(i => i.completed).length;
    const totalCount = mockVisibilityReportData.checklist.length;
  return (
    <MockDashboardCard className="p-6">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-800">Optimization Checklist</h3>
            <span className="text-sm font-medium text-gray-600">
                Completed: {completedCount} / {totalCount}
            </span>
        </div>
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2 relative">
            {mockVisibilityReportData.checklist.map((item, index) => (
              <label
                key={index}
                htmlFor={`mock-checklist-item-${index}`}
                className={cn(
                    "flex items-start p-3 rounded-lg cursor-pointer relative transition-all duration-300",
                    item.completed ? "bg-gray-100 shadow-sm" : "bg-white hover:bg-gray-50",
                )}
              >
                <input
                    type="checkbox"
                    id={`mock-checklist-item-${index}`}
                    className="h-5 w-5 rounded border-gray-300 text-[#7762ff] focus:ring-[#7762ff] focus:ring-offset-0 accent-[#7762ff]"
                    checked={item.completed}
                    readOnly
                />
                <span className={cn(
                    "ml-3 text-sm transition-all duration-300",
                    item.completed ? "text-gray-500 line-through" : "text-gray-800"
                )}>
                    {item.text}
                </span>
            </label>
            ))}
        </div>
      </div>
    </MockDashboardCard>
  );
};

export default MockOptimizationChecklistCard; 