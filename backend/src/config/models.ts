/**
 * @file models.ts
 * @description This file serves as the central configuration hub for all Large Language Model (LLM) related settings.
 * It defines model engines, tasks, and a comprehensive configuration object (`LLM_CONFIG`) that controls various aspects
 * of the LLM's behavior, including concurrency, rate-limiting, logging, and feature-specific parameters like mention detection.
 * It also maps specific models to the tasks they are designated to perform, providing a single source of truth for model capabilities.
 *
 * @exports
 * - ModelEngine: Enum for the different LLM providers (OpenAI, Anthropic, Google, Perplexity).
 * - ModelTask: Enum for the various tasks the models can perform.
 * - Model: Interface for the model object.
 * - LLM_CONFIG: A comprehensive, constant object containing all LLM behavior parameters.
 * - MODELS: A record mapping model IDs to their respective configurations and tasks.
 * - getModelsByTask: A function to retrieve a list of models that can perform a specific task.
 */

// NOTE: Brand tagging prompts are now handled by PydanticAI agents with superior prompt management

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
  FANOUT_MAX_QUERIES_PER_TYPE: 1, // DEPRECATED: New logic uses FANOUT_TOTAL_TARGET and FANOUT_GENERATION_THRESHOLD.
  FANOUT_TOTAL_TARGET: 5, // The target number of total fanout questions per benchmark question.
  FANOUT_GENERATION_THRESHOLD: 3, // If existing questions are AT or ABOVE this, do not generate new ones.
  
  // Response length configuration
  MAX_TOKENS: 8192, // Maximum tokens for model responses to prevent truncation
  
  // Worker parameters
  WORKER_CONCURRENCY: 15, // Allow the worker to process more jobs concurrently
  QUESTION_ANSWERING_CONCURRENCY: 16, // Increased from 12 to 16 to reduce queueing for slower providers
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
    SHOW_GENERATED_CONTENT: false,  // Hide verbose content for cleaner logs
    SHOW_PERFORMANCE: false,        // Show timing and token usage
    SHOW_TECHNICAL_DETAILS: false, // Hide verbose metadata for cleaner logs
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

  // NOTE: Fanout response prompts now handled by PydanticAI agents
} as const;

// This record now represents the single source of truth for all models in the application.
// It is based on the hard-coded values previously found in `llmService.ts` and `reportWorker.ts`.
export const MODELS: Record<string, Model> = {
  'gpt-4.1-mini': {
    id: 'gpt-4.1-mini',
    engine: ModelEngine.OPENAI,
    task: [
      ModelTask.SENTIMENT,                        // ✅ WebSearchSentimentAgent
      ModelTask.FANOUT_GENERATION,               // ✅ FanoutQueryAgent
      ModelTask.QUESTION_ANSWERING,               // ✅ QuestionAnsweringAgent
      ModelTask.SENTIMENT_SUMMARY,                // ✅ SentimentSummaryAgent (only for gpt-4.1-mini)
      ModelTask.OPTIMIZATION_TASKS,               // ✅ OptimizationTaskAgent (moved from gemini)
    ],
  },
  'claude-3-5-haiku-20241022': {
    id: 'claude-3-5-haiku-20241022',
    engine: ModelEngine.ANTHROPIC,
    task: [
      ModelTask.SENTIMENT,                        // ✅ WebSearchSentimentAgent
      ModelTask.FANOUT_GENERATION,               // ✅ FanoutQueryAgent
      ModelTask.QUESTION_ANSWERING,               // ✅ QuestionAnsweringAgent
    ],
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    engine: ModelEngine.GOOGLE,
    task: [
        ModelTask.SENTIMENT,                      // ✅ WebSearchSentimentAgent
        ModelTask.FANOUT_GENERATION,             // ✅ FanoutQueryAgent
        ModelTask.QUESTION_ANSWERING,             // ✅ QuestionAnsweringAgent
        ModelTask.WEBSITE_ENRICHMENT,             // ✅ WebsiteEnrichmentAgent (only for gemini)
      ],
  },
  'sonar': {
    id: 'sonar',
    engine: ModelEngine.PERPLEXITY,
    task: [
        ModelTask.SENTIMENT,                      // ✅ WebSearchSentimentAgent (has web search)
        ModelTask.FANOUT_GENERATION,             // ✅ FanoutQueryAgent
        ModelTask.QUESTION_ANSWERING,             // ✅ QuestionAnsweringAgent (has web search)
      ],
  },
};

// --- Task-specific model lists ---

export const getModelsByTask = (task: ModelTask): Model[] => {
    return Object.values(MODELS).filter(m => m.task.includes(task));
}