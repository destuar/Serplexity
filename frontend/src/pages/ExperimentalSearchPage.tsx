/**
 * @file ExperimentalSearchPage.tsx
 * @description Experimental search page for testing and exploring AI search capabilities.
 * Provides experimental search tools and AI model testing functionality.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - react-router-dom: For navigation.
 * - lucide-react: For icons.
 * - ../services/experimentalSearchService: For experimental search functionality.
 *
 * @exports
 * - ExperimentalSearchPage: The main experimental search page component.
 */
import React, { useState } from 'react';
import SearchBar from '../components/experimental/SearchBar';
import GoogleSerpPane from '../components/experimental/GoogleSerpPane';
import LlmSerpPane from '../components/experimental/LlmSerpPane';

const ExperimentalSearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  // Local model selection state (default to ChatGPT 4.1)
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4.1-mini');

  const handleSubmit = () => {
    if (query.trim()) {
      setSubmittedQuery(query.trim());
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-1 px-4 lg:px-0">
        <div>
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
          <LlmSerpPane
            query={submittedQuery}
            modelId={selectedModel}
            onModelChange={setSelectedModel}
          />
        </div>
      </div>
    </div>
  );
};

export default ExperimentalSearchPage; 