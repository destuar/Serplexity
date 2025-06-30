import React, { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import Card from '../ui/Card';
 
import { searchModels } from '../../services/experimentalSearchService.ts';
import { MODEL_CONFIGS } from '../../types/dashboard';
import FilterDropdown from '../dashboard/FilterDropdown';
import { getModelFilterOptions } from '../../types/dashboard';
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

// Recursively convert a JSON value to a Markdown bullet-list representation
const jsonToMarkdown = (value: unknown, depth = 0): string => {
  const indent = '  '.repeat(depth);

  if (Array.isArray(value)) {
    return value
      .map((item) => `${indent}- ${jsonToMarkdown(item, depth + 1).trim()}`)
      .join('\n');
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    
    // If it's a single-key object with a string/number value, likely a wrapper - unwrap it
    if (entries.length === 1) {
      const [_key, val] = entries[0];
      if (typeof val === 'string' || typeof val === 'number') {
        return `${indent}${val}`;
      }
    }
    
    return entries
      .map(([key, val]) => {
        if (typeof val === 'object') {
          return `${indent}- **${key}**:\n${jsonToMarkdown(val, depth + 1)}`;
        }
        return `${indent}- **${key}**: ${val}`;
      })
      .join('\n');
  }

  // Primitive value
  return `${indent}${String(value)}`;
};

// Helper to prettify raw model text into nicer Markdown
const formatAnswer = (raw: string): string => {
  if (!raw) return raw;

  let text = raw.trim();

  // Attempt to parse as JSON and convert to Markdown if possible
  try {
    const json = JSON.parse(text);
    text = jsonToMarkdown(json);
    // Properly unescape JSON strings (convert literal \n to actual newlines, etc.)
    text = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  } catch {
    // Not valid JSON, continue with other formatting tweaks
  }

  // Strip leading key labels like "company_name: " or "summary: " at beginning of a line
  text = text.replace(/^(?:[A-Za-z0-9_ ]+):\s*(.*)$/gm, (_, val: string) => val.trim());

  // Replace leading bullet characters like "•" or "●" with Markdown dashes while keeping indentation intact
  text = text.replace(/^(\s*)[\u2022\u25CF]\s+/gm, (_, indent: string) => `${indent}- `);

  // Ensure numbered lists have a space after the dot ("1. item")
  text = text.replace(/^(\d+)\.\s*/gm, (_, num: string) => `${num}. `);

  // Handle line breaks for proper Markdown paragraph spacing
  // Split into lines, then rejoin with double newlines to ensure paragraph breaks
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  text = lines.join('\n\n');

  return text;
};

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
          answer: formatAnswer(item.answer),
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
              <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-900 prose-p:mb-4 prose-strong:text-gray-900 prose-code:text-gray-800 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-100 prose-pre:text-gray-800 [&>p]:mb-4 [&>p]:leading-relaxed">
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