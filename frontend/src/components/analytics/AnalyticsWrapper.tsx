/**
 * @file AnalyticsWrapper.tsx
 * @description This file provides example React components that demonstrate how to integrate analytics event tracking
 * into UI elements. It includes components for a report generation button, an add competitor button, a search bar,
 * and a filter dropdown. Each component uses the `useEventTracking` hook to dispatch specific analytics events
 * when user interactions occur. This promotes consistent and comprehensive event tracking across the application.
 *
 * @dependencies
 * - react: The core React library.
 * - ../../hooks/useAnalytics: Custom hook for event tracking.
 *
 * @exports
 * - ReportGenerationButton: A button component that tracks report generation events.
 * - AddCompetitorButton: A button component that tracks competitor addition events.
 * - SearchBar: A search input component that tracks search performed events.
 * - FilterDropdown: A dropdown component that tracks filter applied events.
 */
import React from 'react';
import { useEventTracking } from '../../hooks/useAnalytics';

// Example wrapper for report generation button
export const ReportGenerationButton: React.FC<{
  onGenerateReport: () => void;
  disabled?: boolean;
  reportType?: string;
}> = ({ onGenerateReport, disabled = false, reportType = 'standard' }) => {
  const { trackReportGenerated } = useEventTracking();

  const handleClick = () => {
    trackReportGenerated(reportType);
    onGenerateReport();
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
    >
      Generate Report
    </button>
  );
};

// Example wrapper for competitor addition
export const AddCompetitorButton: React.FC<{
  onAddCompetitor: () => void;
  method?: 'manual' | 'auto-generated';
}> = ({ onAddCompetitor, method = 'manual' }) => {
  const { trackCompetitorAdded } = useEventTracking();

  const handleClick = () => {
    trackCompetitorAdded(method);
    onAddCompetitor();
  };

  return (
    <button
      onClick={handleClick}
      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
    >
      Add Competitor
    </button>
  );
};

// Example wrapper for search functionality
export const SearchBar: React.FC<{
  onSearch: (query: string) => void;
  searchType?: string;
  placeholder?: string;
}> = ({ onSearch, searchType = 'general', placeholder = 'Search...' }) => {
  const { trackSearchPerformed } = useEventTracking();
  const [query, setQuery] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      trackSearchPerformed(searchType, query);
      onSearch(query);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="border rounded px-3 py-2"
      />
      <button type="submit" className="ml-2 bg-blue-600 text-white px-4 py-2 rounded">
        Search
      </button>
    </form>
  );
};

// Example wrapper for filter components
export const FilterDropdown: React.FC<{
  options: Array<{ value: string; label: string }>;
  onFilterChange: (value: string) => void;
  filterType: string;
  currentValue?: string;
}> = ({ options, onFilterChange, filterType, currentValue }) => {
  const { trackFilterApplied } = useEventTracking();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    trackFilterApplied(filterType, value);
    onFilterChange(value);
  };

  return (
    <select
      value={currentValue || ''}
      onChange={handleChange}
      className="border rounded px-3 py-2"
    >
      <option value="">All</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};