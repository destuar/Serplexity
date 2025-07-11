import React, { useState, useRef, useEffect, ComponentType } from 'react';
import { ChevronDown, Check, LucideProps } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MultiSelectOption {
  value: string;
  label: string;
  icon?: ComponentType<LucideProps>;
  logoUrl?: string;
}

interface MultiSelectDropdownProps {
  label: string;
  selectedValues: string[];
  options: MultiSelectOption[];
  onChange: (values: string[]) => void;
  icon?: ComponentType<LucideProps>;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  selectedValues,
  options,
  onChange,
  icon: Icon,
  className = '',
  disabled = false,
  placeholder = 'Select options',
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

  const handleToggle = (optionValue: string) => {
    if (selectedValues.includes(optionValue)) {
      onChange(selectedValues.filter(val => val !== optionValue));
    } else {
      onChange([...selectedValues, optionValue]);
    }
  };

  const handleSelectAll = () => {
    const allValues = options.map(option => option.value);
    if (selectedValues.length === allValues.length) {
      onChange([]);
    } else {
      onChange(allValues);
    }
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) {
      return placeholder;
    } else if (selectedValues.length === 1) {
      const selected = options.find(opt => opt.value === selectedValues[0]);
      return selected?.label || selectedValues[0];
    } else if (selectedValues.length === options.length) {
      return 'All Models';
    } else {
      return `${selectedValues.length} Models`;
    }
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex items-center justify-between w-full lg:w-48 gap-2 px-4 py-2 bg-white rounded-lg shadow-md text-sm transition-colors",
          disabled 
            ? "opacity-50 cursor-not-allowed" 
            : "hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        )}
      >
        <span className="flex items-center gap-2 truncate">
          {Icon && <Icon size={16} />}
          <span className="truncate">{getDisplayText()}</span>
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
        <div className="absolute top-full left-0 mt-1 w-full min-w-48 bg-white rounded-lg shadow-lg z-50 py-2 max-h-64 overflow-y-auto">
          {/* Select All Option */}
          <button
            onClick={handleSelectAll}
            className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between group border-b border-gray-100 mb-1"
          >
            <span className="text-sm font-medium text-gray-700">
              {selectedValues.length === options.length ? 'Deselect All' : 'Select All'}
            </span>
            <div className="w-5 h-5 border-2 border-gray-300 rounded flex items-center justify-center flex-shrink-0">
              {selectedValues.length === options.length && (
                <Check size={14} className="text-blue-600" />
              )}
            </div>
          </button>
          
          {/* Individual Options */}
          {options.map((option) => {
            const OptionIcon = option.icon;
            const isSelected = selectedValues.includes(option.value);
            
            return (
              <button
                key={option.value}
                onClick={() => handleToggle(option.value)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {OptionIcon && <OptionIcon size={16} className="text-gray-400 flex-shrink-0" />}
                  {option.logoUrl && (
                    <img 
                      src={option.logoUrl} 
                      alt={option.label}
                      className="w-4 h-4 rounded-sm flex-shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <span className="text-sm truncate text-gray-700">
                    {option.label}
                  </span>
                </div>
                <div className="w-5 h-5 border-2 border-gray-300 rounded flex items-center justify-center flex-shrink-0 ml-3">
                  {isSelected && (
                    <Check size={14} className="text-blue-600" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown; 