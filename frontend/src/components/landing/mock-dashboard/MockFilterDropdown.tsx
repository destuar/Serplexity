/**
 * @file MockFilterDropdown.tsx
 * @description This component provides a mock filter dropdown for the dashboard preview.
 * It simulates the appearance and basic functionality of a filter selection, allowing users to see
 * how filtering options might look and behave within the dashboard context on the landing page.
 * It is intentionally disabled as it's for display purposes only.
 *
 * @dependencies
 * - react: For core React functionalities.
 * - lucide-react: For icons such as `ChevronDown`.
 * - ../../../lib/utils: For the `cn` utility function to conditionally join CSS class names.
 *
 * @exports
 * - MockFilterDropdown: The React functional component for the mock filter dropdown.
 */
import React, { ComponentType } from 'react';
import { ChevronDown, LucideProps } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface MockFilterOption {
  value: string;
  label: string;
  icon?: ComponentType<LucideProps>;
  logoUrl?: string;
}

interface MockFilterDropdownProps {
  label: string;
  value: string;
  options: MockFilterOption[];
  icon?: ComponentType<LucideProps>;
  className?: string;
  isCompact?: boolean;
}

const MockFilterDropdown: React.FC<MockFilterDropdownProps> = ({
  label,
  value,
  options,
  icon: Icon,
  className = '',
  isCompact = false,
}) => {
  const selectedOption = options.find(option => option.value === value);
  const displayLabel = selectedOption?.label || label;

  const buttonClasses = isCompact 
    ? 'flex items-center justify-between w-full gap-1.5 px-3 py-1.5 bg-white/80 backdrop-blur-sm border border-white/20 rounded-md shadow-sm text-xs transition-colors cursor-default'
    : 'flex items-center justify-between w-full lg:w-48 gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md text-sm transition-colors cursor-default';

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        disabled
        className={cn(buttonClasses, className)}
      >
        <span className="flex items-center gap-2 truncate">
          {Icon && <Icon size={isCompact ? 12 : 16} />}
          {selectedOption?.logoUrl && (
            <img 
              src={selectedOption.logoUrl} 
              alt={selectedOption.label}
              className={`rounded-sm ${isCompact ? 'w-4 h-4' : 'w-5 h-5'}`}
            />
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : displayLabel}
          </span>
        </span>
        <ChevronDown 
          size={isCompact ? 12 : 16} 
          className="text-gray-500"
        />
      </button>
    </div>
  );
};

export default MockFilterDropdown; 