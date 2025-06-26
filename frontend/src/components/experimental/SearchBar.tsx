import React, { KeyboardEvent } from 'react';
import { Search } from 'lucide-react';

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
      <div className="flex items-center w-full max-w-xl h-11 bg-white/50 dark:bg-white/10 backdrop-blur-lg border border-white/30 rounded-full px-5 shadow-md">
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
      </div>
    </div>
  );
};

export default SearchBar; 