/**
 * @file MockDashboardCard.tsx
 * @description This component serves as a generic card container for displaying various metrics and information
 * within the mock dashboard preview. It provides consistent styling, including background, borders, shadows,
 * and padding, ensuring a uniform look and feel across all dashboard elements on the landing page.
 *
 * @dependencies
 * - react: For core React functionalities.
 * - ../../../../lib/utils: For the `cn` utility function to conditionally join CSS class names.
 *
 * @exports
 * - MockDashboardCard: The React functional component that acts as a styled container for dashboard elements.
 */
import React from 'react';
import { cn } from '../../../../lib/utils';

interface MockDashboardCardProps {
  children: React.ReactNode;
  className?: string;
  isCompact?: boolean;
}

const MockDashboardCard: React.FC<MockDashboardCardProps> = ({ children, className, isCompact = false }) => {
  return (
    <div
      className={cn(
        'bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200/80 shadow-md h-full flex flex-col',
        isCompact ? 'p-2' : 'p-4',
        className
      )}
    >
      {children}
    </div>
  );
};

export default MockDashboardCard; 