import React, { useState, useRef, useEffect, ComponentType } from 'react';
import { ChevronDown, Check, LucideProps } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FilterOption {
  value: string;
  label: string;
  icon?: ComponentType<LucideProps>;
}

interface FilterDropdownProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  icon?: ComponentType<LucideProps>;
  className?: string;
  disabled?: boolean;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
  label,
  value,
  options,
  onChange,
  icon: Icon,
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const selectedOption = options.find(option => option.value === value);
  const displayLabel = selectedOption?.label || label;

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex items-center justify-between w-full lg:w-48 gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200 text-sm transition-colors",
          disabled 
            ? "opacity-50 cursor-not-allowed" 
            : "hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        )}
      >
        <span className="flex items-center gap-2 truncate">
          {Icon && <Icon size={16} />}
          <span className="truncate">{displayLabel}</span>
        </span>
        <ChevronDown 
          size={16} 
          className={cn(
            "transition-transform duration-200",
            isOpen ? "rotate-180" : "",
            disabled ? "text-gray-400" : "text-gray-500"
          )} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
          {options.map((option) => {
            const OptionIcon = option.icon;
            const isSelected = option.value === value;
            
            return (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  {OptionIcon && <OptionIcon size={16} className="text-gray-400" />}
                  <span className={cn(
                    "text-sm truncate",
                    isSelected ? "font-medium text-gray-900" : "text-gray-700"
                  )}>
                    {option.label}
                  </span>
                </div>
                {isSelected && (
                  <Check size={16} className="text-blue-600" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FilterDropdown; 