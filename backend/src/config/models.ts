export const enum ModelEngine {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  PERPLEXITY = 'perplexity',
}

export const enum ModelTask {
  SENTIMENT = 'sentiment',
  VISIBILITY = 'visibility',
  BENCHMARKING = 'benchmarking',
  SENTIMENT_SUMMARY = 'sentiment_summary',
  WEBSITE_ANALYSIS = 'website_analysis',
  PERSONAL_QUESTION_GENERATION = 'personal_question_generation',
  QUESTION_ANSWERING = 'question_answering',
  WEBSITE_ENRICHMENT = 'website_enrichment',
}

export interface Model {
  id: string;
  engine: ModelEngine;
  task: ModelTask[];
}

// ===== CENTRALIZED CONFIGURATION =====
// All LLM behavior parameters are controlled here

export const LLM_CONFIG = {
  // Question generation parameters
  VISIBILITY_QUESTIONS_COUNT: 20,
  BENCHMARK_VARIATIONS_COUNT: 20,
  PERSONAL_QUESTIONS_COUNT: 20,
  
  // Response length configuration
  MAX_TOKENS: 8192, // Maximum tokens for model responses to prevent truncation
  
  // Worker parameters
  WORKER_CONCURRENCY: 10,
  QUESTION_ANSWERING_CONCURRENCY: 25, // Higher concurrency for individual question processing
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
    STREAMING_BATCH_TIMEOUT: 30000,  // 30 seconds for streaming batches
    STREAMING_BATCH_MAX_WAIT: 5000,  // 5 seconds max wait for streaming batches
  },
  
  // Logging configuration - Simple on/off toggles
  LOGGING: {
    SHOW_STAGES: true,              // Show stage transitions (START/COMPLETE)
    SHOW_GENERATED_CONTENT: true,   // Show actual questions, competitors, responses
    SHOW_PERFORMANCE: false,        // Show timing and token usage
    SHOW_TECHNICAL_DETAILS: false, // Show model IDs, metadata, etc.
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
} as const;

// This record now represents the single source of truth for all models in the application.
// It is based on the hard-coded values previously found in `llmService.ts` and `reportWorker.ts`.
export const MODELS: Record<string, Model> = {
  'gpt-4.1-mini': {
    id: 'gpt-4.1-mini',
    engine: ModelEngine.OPENAI,
    task: [
      ModelTask.SENTIMENT,                        // ✅ Used for sentiment analysis
      ModelTask.VISIBILITY,                       // ✅ Used for visibility question generation
      ModelTask.BENCHMARKING,                     // ✅ Used for benchmark question generation  
      ModelTask.SENTIMENT_SUMMARY,                // ✅ Used for sentiment summaries
      ModelTask.PERSONAL_QUESTION_GENERATION,     // ✅ Used for personal question generation
      ModelTask.QUESTION_ANSWERING                // ✅ Used for answering questions
    ],
  },
  'claude-3-5-haiku-20241022': {
    id: 'claude-3-5-haiku-20241022',
    engine: ModelEngine.ANTHROPIC,
    task: [
      ModelTask.SENTIMENT,                        // ✅ Used for sentiment analysis
      ModelTask.QUESTION_ANSWERING                // ✅ Used for answering questions
    ],
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    engine: ModelEngine.GOOGLE,
    task: [
        ModelTask.SENTIMENT,                      // ✅ Used for sentiment analysis
        ModelTask.QUESTION_ANSWERING,             // ✅ Used for answering questions
        ModelTask.WEBSITE_ENRICHMENT              // ✅ Used for enriching competitors with websites
      ],
  },
  'sonar': {
    id: 'sonar',
    engine: ModelEngine.PERPLEXITY,
    task: [
        ModelTask.SENTIMENT,                      // ✅ Used for sentiment analysis
        ModelTask.WEBSITE_ANALYSIS,               // ✅ Used for website analysis (has web search)
        ModelTask.QUESTION_ANSWERING              // ✅ Used for answering questions (has web search)
      ],
  },
};

// --- Task-specific model lists ---

export const getModelsByTask = (task: ModelTask): Model[] => {
    return Object.values(MODELS).filter(m => m.task.includes(task));
}