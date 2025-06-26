import React, { useState, useEffect } from 'react';
import SearchBar from '../components/experimental/SearchBar';
import GoogleSerpPane from '../components/experimental/GoogleSerpPane';
import LlmSerpPane from '../components/experimental/LlmSerpPane';
import { getModelFilterOptions } from '../types/dashboard';
import { useDashboard } from '../hooks/useDashboard';

const ExperimentalSearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const { filters, updateFilters, loading } = useDashboard();

  const handleSubmit = () => {
    if (query.trim()) {
      setSubmittedQuery(query.trim());
    }
  };

  const aiModelOptions = getModelFilterOptions().filter((o) => o.value !== 'all');

  const selectedModel = filters.aiModel === 'all' ? aiModelOptions[0].value : (filters.aiModel as string);

  // Ensure "all" is never selected – default to first model
  useEffect(() => {
    if (filters.aiModel === 'all') {
      updateFilters({ aiModel: aiModelOptions[0].value as any });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-1 px-4 lg:px-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Experimental Search</h1>
        </div>
        {/* model filter moved to LlmSerpPane */}
      </div>

      {/* Search Bar */}
      <div className="px-4 lg:px-0 mb-4">
        <SearchBar value={query} onChange={setQuery} onSubmit={handleSubmit} />
      </div>

      {/* Two Pane Layout */}
      <div className="flex-1 min-h-0 p-1">
        <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-5">
          <GoogleSerpPane query={submittedQuery} />
          <LlmSerpPane query={submittedQuery} modelId={selectedModel as string} />
        </div>
      </div>
    </div>
  );
};

export default ExperimentalSearchPage; 