import { FANOUT_RESPONSE_SYSTEM_PROMPT } from '../prompts';

export const enum ModelEngine {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  PERPLEXITY = 'perplexity',
}

export const enum ModelTask {
  SENTIMENT = 'sentiment',
  FANOUT_GENERATION = 'fanout_generation',
  SENTIMENT_SUMMARY = 'sentiment_summary',
  WEBSITE_ANALYSIS = 'website_analysis',
  QUESTION_ANSWERING = 'question_answering',
  WEBSITE_ENRICHMENT = 'website_enrichment',
  OPTIMIZATION_TASKS = 'optimization_tasks',
}

export interface Model {
  id: string;
  engine: ModelEngine;
  task: ModelTask[];
}

// ===== CENTRALIZED CONFIGURATION =====
// All LLM behavior parameters are controlled here

export const LLM_CONFIG = {
  // Fanout generation parameters
  FANOUT_CONCURRENCY: 4, // Increased to allow more parallel fanout generation (tuned for current rate limits)
  FANOUT_MAX_QUERIES_PER_TYPE: 4, // Allow up to 4 queries per type per model for comprehensive coverage
  
  // Response length configuration
  MAX_TOKENS: 8192, // Maximum tokens for model responses to prevent truncation
  
  // Worker parameters
  WORKER_CONCURRENCY: 15, // Allow the worker to process more jobs concurrently
  QUESTION_ANSWERING_CONCURRENCY: 12, // Increased but still below original 25 to balance DB load
  WORKER_RATE_LIMIT: {
    max: 10,
    duration: 1000, // milliseconds
  },
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_BACKOFF_BASE: 1000, // milliseconds
  
  // Model selection weights (for load balancing)
  MODEL_SELECTION: {
    PREFER_FASTEST: false, // If true, prioritizes faster models
    ROUND_ROBIN: true,     // If true, distributes load evenly
  },
  
  // Timeout configurations
  TIMEOUTS: {
    MODEL_RESPONSE: 30000,      // 30 seconds
    TRANSACTION_MAX_WAIT: 30000, // 30 seconds
    TRANSACTION_TIMEOUT: 120000,  // 120 seconds (legacy, kept for non-streaming operations)
    STREAMING_BATCH_TIMEOUT: 90000,  // 90 seconds for streaming batches (increased from 30s)
    STREAMING_BATCH_MAX_WAIT: 15000,  // 15 seconds max wait for streaming batches (increased from 5s)
  },
  
  // Logging configuration - Simple on/off toggles
  LOGGING: {
    SHOW_STAGES: true,              // Show stage transitions (START/COMPLETE)
    SHOW_GENERATED_CONTENT: true,   // Show actual questions, competitors, responses
    SHOW_PERFORMANCE: false,        // Show timing and token usage
    SHOW_TECHNICAL_DETAILS: true, // Show model IDs, metadata, etc.
    SHOW_ERRORS: true,              // Show error messages
  },
  
  // Enhanced mention detection configuration
  MENTION_DETECTION: {
    ENABLE_CONTEXTUAL_PATTERNS: true,      // Enable "like", "such as" patterns
    ENABLE_ACRONYM_GENERATION: true,       // Generate acronyms for multi-word companies
    ENABLE_CORPORATE_SUFFIX_REMOVAL: true, // Remove Inc, LLC, etc.
    MIN_CONFIDENCE_THRESHOLD: 0.7,         // Minimum confidence to include mention
    MAX_VARIATIONS_PER_ENTITY: 20,         // Limit variations to prevent performance issues
    DEBUG_MODE: false,                     // Enable detailed mention detection logging
    COMPREHENSIVE_CORPORATE_SUFFIXES: true, // Use extended corporate suffix list
    ENABLE_PUNCTUATION_PATTERNS: true,     // Match names followed by punctuation
    ENABLE_QUOTED_PATTERNS: true,          // Match names in quotes/parentheses
  },

  // Fanout response system prompt for brand tagging – centralised constant
  FANOUT_RESPONSE_SYSTEM_PROMPT: FANOUT_RESPONSE_SYSTEM_PROMPT,
} as const;

// This record now represents the single source of truth for all models in the application.
// It is based on the hard-coded values previously found in `llmService.ts` and `reportWorker.ts`.
export const MODELS: Record<string, Model> = {
  'gpt-4.1-mini': {
    id: 'gpt-4.1-mini',
    engine: ModelEngine.OPENAI,
    task: [
      ModelTask.SENTIMENT,                        // ✅ Used for sentiment analysis
      ModelTask.FANOUT_GENERATION,               // ✅ Used for fanout query generation
      ModelTask.SENTIMENT_SUMMARY,                // ✅ Used for sentiment summaries
      ModelTask.QUESTION_ANSWERING,               // ✅ Used for answering questions
      ModelTask.OPTIMIZATION_TASKS                // ✅ Used for generating optimization tasks and summaries
    ],
  },
  'claude-3-5-haiku-20241022': {
    id: 'claude-3-5-haiku-20241022',
    engine: ModelEngine.ANTHROPIC,
    task: [
      ModelTask.SENTIMENT,                        // ✅ Used for sentiment analysis
      ModelTask.FANOUT_GENERATION,               // ✅ Used for fanout query generation
      ModelTask.SENTIMENT_SUMMARY,                // ✅ Used for sentiment summaries
      ModelTask.QUESTION_ANSWERING                // ✅ Used for answering questions
    ],
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    engine: ModelEngine.GOOGLE,
    task: [
        ModelTask.SENTIMENT,                      // ✅ Used for sentiment analysis
        ModelTask.FANOUT_GENERATION,             // ✅ Used for fanout query generation
        ModelTask.QUESTION_ANSWERING,             // ✅ Used for answering questions
        ModelTask.WEBSITE_ENRICHMENT,             // ✅ Used for enriching competitors with websites
        ModelTask.OPTIMIZATION_TASKS              // ✅ Now used for generating optimization tasks and summaries
      ],
  },
  'sonar': {
    id: 'sonar',
    engine: ModelEngine.PERPLEXITY,
    task: [
        ModelTask.SENTIMENT,                      // ✅ Used for sentiment analysis
        ModelTask.FANOUT_GENERATION,             // ✅ Used for fanout query generation
        ModelTask.WEBSITE_ANALYSIS,               // ✅ Used for website analysis (has web search)
        ModelTask.QUESTION_ANSWERING              // ✅ Used for answering questions (has web search)
      ],
  },
};

// --- Task-specific model lists ---

export const getModelsByTask = (task: ModelTask): Model[] => {
    return Object.values(MODELS).filter(m => m.task.includes(task));
}