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
    ? 'flex items-center justify-between w-full gap-1.5 px-3 py-1.5 bg-white rounded-md shadow-sm text-xs transition-colors cursor-default'
    : 'flex items-center justify-between w-full lg:w-48 gap-2 px-4 py-2 bg-white rounded-lg shadow-md text-sm transition-colors cursor-default';

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
            {selectedOption ? (
              <>
                <span className="text-gray-500">{label}: </span>
                <span>{selectedOption.label}</span>
              </>
            ) : (
              displayLabel
            )}
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