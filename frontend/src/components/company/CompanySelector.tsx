/**
 * @file CompanySelector.tsx
 * @description This component provides a dropdown for users to select their active company or create a new one.
 * It integrates with the `useCompany` hook from `CompanyContext` to display the list of companies, manage the
 * selected company, and enforce the maximum company creation limit. It also uses `CompanyLogo` to display visual
 * cues for each company. This component is crucial for multi-company support and user navigation within the application.
 *
 * @dependencies
 * - react: The core React library.
 * - lucide-react: Icon library for React.
 * - ../../contexts/CompanyContext: Provides company-related data and actions.
 * - ../../lib/utils: Utility functions (e.g., `cn` for class names).
 * - ./CompanyLogo: Component for displaying company logos or initials.
 *
 * @exports
 * - CompanySelector: React functional component for selecting or creating companies.
 */
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Check } from 'lucide-react';
import { useCompany, Company } from '../../contexts/CompanyContext';
import { cn } from '../../lib/utils';
import CompanyLogo from './CompanyLogo';

interface CompanySelectorProps {
  onCreateNew?: () => void;
  className?: string;
}

const CompanySelector: React.FC<CompanySelectorProps> = ({
  onCreateNew,
  className = ''
}) => {
  const { companies, selectedCompany, selectCompany, loading, canCreateMore, maxCompanies } = useCompany();
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

  // Handle company selection
  const handleSelectCompany = (company: Company) => {
    selectCompany(company);
    setIsOpen(false);
  };

  // Handle create new company
  const handleCreateNew = () => {
    setIsOpen(false);
    if (onCreateNew) {
      onCreateNew();
    }
  };

  // If no companies or loading, show loading state
  if (loading || companies.length === 0) {
    return (
      <div className={cn("flex items-center justify-between w-full lg:w-64 gap-2 px-2 py-2 text-xl font-bold", className)}>
        <span className="truncate text-gray-500">
          {loading ? 'Loading...' : 'No Company'}
        </span>
        <ChevronDown size={16} className="text-gray-400" />
      </div>
    );
  }

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full lg:w-64 gap-3 px-2 py-2 hover:bg-gray-50 transition-colors text-xl font-bold"
      >
        <span className="truncate">
          {selectedCompany?.name || 'Select Company'}
        </span>
        <ChevronDown 
          size={18} 
          className={cn(
            "transition-transform duration-200 text-gray-600 flex-shrink-0",
            isOpen ? "rotate-180" : ""
          )} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
          {/* Company List */}
          <div className="max-h-64 overflow-y-auto">
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => handleSelectCompany(company)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <CompanyLogo 
                    company={company} 
                    size="sm"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {company.name}
                    </span>
                    {company.industry && (
                      <span className="text-xs text-gray-500 truncate">
                        {company.industry}
                      </span>
                    )}
                  </div>
                </div>
                {selectedCompany?.id === company.id && (
                  <Check size={16} className="text-[#7762ff]" />
                )}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-1"></div>

          {/* Create New Company Option */}
          <button
            onClick={canCreateMore ? handleCreateNew : undefined}
            disabled={!canCreateMore}
            className={`w-full px-4 py-3 text-left transition-colors flex items-center gap-3 group ${
              canCreateMore 
                ? 'hover:bg-[#7762ff]/10 cursor-pointer' 
                : 'cursor-not-allowed opacity-50'
            }`}
          >
            <Plus size={16} className={canCreateMore ? 'text-[#7762ff]' : 'text-gray-400'} />
            <div className="flex flex-col">
              <span className={`text-sm font-medium ${
                canCreateMore 
                  ? 'text-[#7762ff] group-hover:text-[#6650e6]' 
                  : 'text-gray-400'
              }`}>
                Create New
              </span>
              {!canCreateMore && (
                <span className="text-xs text-gray-400">
                  Maximum {maxCompanies} companies reached
                </span>
              )}
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

export default CompanySelector; 