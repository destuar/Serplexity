/**
 * @file FilterDropdown.tsx
 * @description This component provides a reusable and customizable filter dropdown. It displays a label,
 * the currently selected value, and a list of options. It supports optional icons and logo URLs for each option,
 * and handles opening/closing the dropdown, selecting options, and disabling the component. This is a versatile
 * UI component used across the dashboard for filtering data.
 *
 * @dependencies
 * - react: The core React library.
 * - lucide-react: Icon library for React.
 * - ../../lib/utils: Utility functions (e.g., `cn` for class names).
 *
 * @exports
 * - FilterDropdown: React functional component for a customizable filter dropdown.
 */
import { Check, ChevronDown, LucideProps } from "lucide-react";
import React, { ComponentType, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

interface FilterOption {
  value: string;
  label: string;
  icon?: ComponentType<LucideProps>;
  logoUrl?: string;
}

interface FilterDropdownProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  icon?: ComponentType<LucideProps>;
  className?: string;
  disabled?: boolean;
  noShadow?: boolean;
  autoWidth?: boolean;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
  label,
  value,
  options,
  onChange,
  icon: Icon,
  className = "",
  disabled = false,
  noShadow = false,
  autoWidth = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const selectedOption = options.find((option) => option.value === value);
  const displayLabel = selectedOption?.label || label;

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          `flex items-center justify-between ${autoWidth ? "w-auto" : "w-full lg:w-48"} gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg ${noShadow ? "shadow-none" : "shadow-md"} text-sm transition-colors`,
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-white/85 focus:outline-none focus:ring-2 focus:ring-black"
        )}
      >
        <span className="flex items-center gap-2 truncate">
          {Icon && <Icon size={16} />}
          {selectedOption?.logoUrl && (
            <img
              src={selectedOption.logoUrl}
              alt={selectedOption.label}
              className="w-5 h-5 rounded-sm"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
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
        <div className="absolute top-full left-0 mt-1 w-full min-w-48 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md z-50 py-1">
          {options.map((option) => {
            const OptionIcon = option.icon;
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className="w-full px-4 py-3 text-left hover:bg-white/20 transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  {OptionIcon && (
                    <OptionIcon size={16} className="text-gray-400" />
                  )}
                  {option.logoUrl && (
                    <img
                      src={option.logoUrl}
                      alt={option.label}
                      className="w-4 h-4 rounded-sm"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  <span
                    className={cn(
                      "text-sm truncate",
                      isSelected ? "font-medium text-gray-900" : "text-gray-700"
                    )}
                  >
                    {option.label}
                  </span>
                </div>
                {isSelected && <Check size={16} className="text-black" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FilterDropdown;
