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