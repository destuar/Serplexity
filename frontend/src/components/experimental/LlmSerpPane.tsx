import React, { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import Card from '../ui/Card';
 
import { searchModels } from '../../services/experimentalSearchService.ts';
import { MODEL_CONFIGS } from '../../types/dashboard';
import FilterDropdown from '../dashboard/FilterDropdown';
import { getModelFilterOptions } from '../../types/dashboard';
import { formatResponseText } from '../../lib/responseFormatter';
import remarkGfm from 'remark-gfm';

interface Props {
  query: string;
  modelId: string;
  onModelChange: (modelId: string) => void;
}

interface ChatItem {
  engine: string;
  answer: string;
  latencyMs: number;
}

interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
  };
  message?: string;
}



const LlmSerpPane: React.FC<Props> = ({ query, modelId, onModelChange }) => {
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<ChatItem[]>([]);

  const aiModelOptions = getModelFilterOptions().filter((o) => o.value !== 'all');

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    setAnswers([]);
    (async () => {
      try {
        const res = await searchModels(query, modelId);
        const formatted = res.map((item) => ({
          ...item,
          answer: formatResponseText(item.answer),
        }));

        if (formatted.length === 0 || formatted[0].answer.trim() === '') {
          setAnswers([{ engine: modelId, answer: '**No answer returned.**', latencyMs: 0 }]);
        } else {
          setAnswers(formatted);
        }
      } catch (err: unknown) {
        console.error('Failed to fetch model answer:', err);
        const msg = (err as ApiError)?.response?.data?.error || (err as ApiError)?.message || 'Unknown error';
        // Show the error as a pseudo-answer so it appears in the chat stream
        setAnswers([{ engine: modelId, answer: `**Error:** ${msg}` , latencyMs: 0 }]);
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

  return (
    <Card className="h-full flex flex-col overflow-hidden p-4">
      {/* Header with model dropdown */}
      <div className="flex items-center gap-2 mb-3 sticky top-0 bg-white/80 backdrop-blur z-10 py-1">
        <FilterDropdown
          label="Model"
          value={modelId}
          options={aiModelOptions}
          onChange={(v) => onModelChange(v as string)}
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
            <div className="max-w-[75%] rounded-2xl bg-white/40 dark:bg-white/5 backdrop-blur-lg border border-white/30 px-4 py-2 text-sm text-gray-900 shadow ring-1 ring-white/20">
              {/* By controlling the paragraph margins directly, we get consistent spacing without conflicts */}
              <div className="text-sm text-gray-900 [&_p]:mb-3">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // Customize code blocks
                    code: ({ className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || '');
                      return match ? (
                        <pre className="bg-gray-100 rounded p-2 overflow-x-auto">
                          <code className={className} {...props}>
                            {children}
                          </code>
                        </pre>
                      ) : (
                        <code className="bg-gray-100 px-1 py-0.5 rounded text-sm" {...props}>
                          {children}
                        </code>
                      );
                    },
                    // Ensure links open in new tab
                    a: ({ href, children, ...props }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline" {...props}>
                        {children}
                      </a>
                    ),
                  }}
                >
                  {a.answer}
                </ReactMarkdown>
              </div>
              <div className="mt-2 text-xs text-gray-500">— {MODEL_CONFIGS[a.engine]?.displayName || a.engine} • {a.latencyMs} ms</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default LlmSerpPane; 