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
  COMPETITOR_ANALYSIS = 'competitor_analysis',
  SENTIMENT_SUMMARY = 'sentiment_summary',
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
  VISIBILITY_QUESTIONS_COUNT: 5,
  BENCHMARK_VARIATIONS_COUNT: 4,
  
  // Competitor generation parameters
  COMPETITOR_GENERATION_COUNT: '20+', // Can be exact number or string like "20+"
  
  // Worker parameters
  WORKER_CONCURRENCY: 5,
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
    TRANSACTION_TIMEOUT: 60000,  // 60 seconds
  },
  
  // Logging configuration - Simple on/off toggles
  LOGGING: {
    SHOW_STAGES: true,              // Show stage transitions (START/COMPLETE)
    SHOW_GENERATED_CONTENT: true,   // Show actual questions, competitors, responses
    SHOW_PERFORMANCE: false,        // Show timing and token usage
    SHOW_TECHNICAL_DETAILS: false, // Show model IDs, metadata, etc.
    SHOW_ERRORS: true,              // Show error messages
  },
} as const;

// This record now represents the single source of truth for all models in the application.
// It is based on the hard-coded values previously found in `llmService.ts` and `reportWorker.ts`.
export const MODELS: Record<string, Model> = {
  'gpt-4.1': {
    id: 'gpt-4.1',
    engine: ModelEngine.OPENAI,
    task: [
      ModelTask.SENTIMENT,
      ModelTask.VISIBILITY,
      ModelTask.BENCHMARKING,
      ModelTask.COMPETITOR_ANALYSIS,
      ModelTask.SENTIMENT_SUMMARY
    ],
  },
  'claude-3-5-haiku-20241022': {
    id: 'claude-3-5-haiku-20241022',
    engine: ModelEngine.ANTHROPIC,
    task: [
      ModelTask.SENTIMENT, 
      ModelTask.VISIBILITY,
      ModelTask.BENCHMARKING
    ],
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    engine: ModelEngine.GOOGLE,
    task: [
        ModelTask.SENTIMENT, 
        ModelTask.VISIBILITY,
        ModelTask.BENCHMARKING
      ],
  },
  'sonar': {
    id: 'sonar',
    engine: ModelEngine.PERPLEXITY,
    task: [
        ModelTask.SENTIMENT, 
        ModelTask.VISIBILITY,
        ModelTask.BENCHMARKING
      ],
  },
};

// --- Task-specific model lists ---

export const getModelsByTask = (task: ModelTask): Model[] => {
    return Object.values(MODELS).filter(m => m.task.includes(task));
}