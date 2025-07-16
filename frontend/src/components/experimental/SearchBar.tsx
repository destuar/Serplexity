/**
 * @file SearchBar.tsx
 * @description This component provides a reusable search input bar with an integrated search icon and submit button.
 * It handles user input, triggers search actions on Enter key press or button click, and is designed for general search functionalities.
 *
 * @dependencies
 * - react: The core React library for component logic and event handling.
 * - lucide-react: Icon library for the search and arrow icons.
 *
 * @exports
 * - SearchBar: React functional component for a search input interface.
 */
import React, { KeyboardEvent } from 'react';
import { Search, ArrowRight } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange, onSubmit }) => {
  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="w-full flex justify-center px-2">
      <div className="flex items-center w-full max-w-xl h-11 bg-white/50 dark:bg-white/10 backdrop-blur-lg border border-white/30 rounded-full pl-5 pr-2 shadow-md">
        <button
          onClick={onSubmit}
          type="button"
          className="focus:outline-none mr-3 text-gray-500 hover:text-gray-700"
        >
          <Search size={15} strokeWidth={2} />
        </button>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Enter your question ..."
          className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-500 text-sm"
        />
        <button
          onClick={onSubmit}
          type="button"
          className="focus:outline-none ml-8 p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100/50 rounded-full transition-all duration-200"
        >
          <ArrowRight size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};

export default SearchBar; 