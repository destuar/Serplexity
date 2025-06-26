import React, { useEffect, useState, useRef } from 'react';
import Card from '../ui/Card';
// eslint-disable-next-line import/extensions
import { searchModels } from '../../services/experimentalSearchService.ts';
import { MODEL_CONFIGS } from '../../types/dashboard';
import FilterDropdown from '../dashboard/FilterDropdown';
import { getModelFilterOptions } from '../../types/dashboard';
import { useDashboard } from '../../hooks/useDashboard';

interface Props {
  query: string;
  modelId: string;
}

interface ChatItem {
  engine: string;
  answer: string;
  latencyMs: number;
}

const LlmSerpPane: React.FC<Props> = ({ query, modelId }) => {
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<ChatItem[]>([]);

  const { updateFilters } = useDashboard();
  const aiModelOptions = getModelFilterOptions().filter((o) => o.value !== 'all');

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    setAnswers([]);
    (async () => {
      try {
        const res = await searchModels(query, modelId);
        setAnswers(res);
      } finally {
        setLoading(false);
      }
    })();
  }, [query, modelId]);

  // Auto-scroll to bottom when a new answer arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [answers]);

  const displayName = MODEL_CONFIGS[modelId]?.displayName || modelId;

  return (
    <Card className="h-full flex flex-col overflow-hidden p-4">
      {/* Header with model dropdown */}
      <div className="flex items-center gap-2 mb-3 sticky top-0 bg-white/80 backdrop-blur z-10 py-1">
        <FilterDropdown
          label="Model"
          value={modelId}
          options={aiModelOptions}
          onChange={(v) => updateFilters({ aiModel: v as any })}
          icon={undefined}
          disabled={loading}
          noShadow
          autoWidth
        />
      </div>

      {/* loading indicator intentionally removed */}

      {/* Chat scroll area */}
      <div ref={scrollRef} className="flex-1 flex flex-col space-y-4 overflow-y-auto pr-3 pl-2 pb-3">
        {/* Center placeholder with mock SearchBar */}
        {!query && !loading && (
          <div className="flex-1 flex flex-col items-center mt-20 space-y-6">
            <p className="text-base text-gray-400">Where should we begin?</p>

            {/* Fake search bar */}
            <div className="w-full max-w-md flex items-center bg-white border border-gray-200 rounded-full shadow-sm px-4 py-2">
              <div className="text-gray-400 mr-4 cursor-pointer select-none">+</div>
              <input
                type="text"
                placeholder="Ask anything"
                className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
                disabled
              />
            </div>
          </div>
        )}

        {/* User prompt */}
        {query && (
          <div className="flex justify-end">
            <div className="max-w-[75%] rounded-2xl bg-white/60 dark:bg-white/10 backdrop-blur-lg border border-white/30 px-4 py-2 text-sm text-gray-900 whitespace-pre-line shadow">
              {query}
            </div>
          </div>
        )}

        {/* Typing indicator while loading */}
        {loading && query && (
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-2xl bg-white/20 backdrop-blur-lg border border-white/30 px-4 py-2 shadow ring-1 ring-white/20 flex items-center space-x-1 animate-pulse">
              <span className="block w-1.5 h-1.5 bg-gray-500 rounded-full" />
              <span className="block w-1.5 h-1.5 bg-gray-500 rounded-full" />
              <span className="block w-1.5 h-1.5 bg-gray-500 rounded-full" />
            </div>
          </div>
        )}

        {/* Model answer(s) */}
        {answers.map((a) => (
          <div key={a.engine} className="flex justify-start">
            <div className="max-w-[75%] rounded-2xl bg-white/40 dark:bg-white/5 backdrop-blur-lg border border-white/30 px-4 py-2 text-sm text-gray-900 whitespace-pre-line shadow ring-1 ring-white/20">
              {a.answer}
              <div className="mt-2 text-xs text-gray-500">— {MODEL_CONFIGS[a.engine]?.displayName || a.engine} • {a.latencyMs} ms</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default LlmSerpPane; 