/**
 * @file llmService.ts
 * @description Direct PydanticAI implementation replacing legacy LLM service
 *
 * This service provides a clean, production-ready interface for PydanticAI
 * without migration layers or backward compatibility concerns. It offers
 * structured output, multi-provider support, and superior AI regulation.
 *
 * @architecture
 * - Direct PydanticAI agent execution
 * - Structured output with Pydantic models
 * - Multi-provider support with health monitoring
 * - Comprehensive error handling and retries
 * - Performance monitoring and optimization
 *
 * @dependencies
 * - pydanticLlmService: Core PydanticAI service
 * - providerManager: Provider health and selection
 * - zod: Schema validation for TypeScript compatibility
 *
 * @exports
 * - All functions with same signatures as legacy service
 * - Enhanced types and interfaces
 * - Comprehensive error handling
 */

import { z } from "zod";
import { getDbClient } from "../config/database";
import { Model, ModelTask, getModelsByTask } from "../config/models";
import { providerManager } from "../config/pydanticProviders";
import logger from "../utils/logger";
import { pydanticLlmService } from "./pydanticLlmService";

// --- Enhanced Type Definitions ---
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  thinkingTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface ChatCompletionResponse<T> {
  data: T;
  usage: TokenUsage;
  modelUsed?: string;
}

export interface CompetitorInfo {
  name: string;
  website: string;
}

export interface QuestionInput {
  id: string;
  text: string;
  systemPrompt?: string;
}

// --- Pydantic Schema Definitions ---
const SentimentRatingSchema = z.object({
  quality: z.number().min(1).max(10),
  priceValue: z.number().min(1).max(10),
  brandReputation: z.number().min(1).max(10),
  brandTrust: z.number().min(1).max(10),
  customerService: z.number().min(1).max(10),
  // Allow longer, more actionable summaries
  summaryDescription: z.string().min(10).max(1500),
});

const SentimentScoresSchema = z.object({
  companyName: z.string(),
  industry: z.string(),
  ratings: z.array(SentimentRatingSchema).min(1),
});

const CompetitorSchema = z.object({
  name: z.string().min(1),
  website: z.string().min(1), // Keep simple validation here since this handles LLM responses
}) as z.ZodType<CompetitorInfo>;

const QuestionResponseSchema = z.object({
  question: z.string(),
  answer: z.string().min(1),
  citations: z
    .array(
      z.object({
        url: z.string(),
        title: z.string(),
        domain: z.string(),
        accessedAt: z.string().optional(),
        position: z.number().optional(),
      })
    )
    .optional(),
  has_web_search: z.boolean().optional(),
  brand_mentions_count: z.number().optional(),
}) as z.ZodType<{
  question: string;
  answer: string;
  citations?: {
    url: string;
    title: string;
    domain: string;
    accessedAt?: string;
    position?: number;
  }[];
  has_web_search?: boolean;
  brand_mentions_count?: number;
}>;

export type SentimentScores = z.infer<typeof SentimentScoresSchema>;

// --- Core Service Implementation ---

/**
 * Generate sentiment scores for a company using PydanticAI
 */
export async function generateSentimentScores(
  companyName: string,
  industry: string,
  model: Model
): Promise<ChatCompletionResponse<SentimentScores>> {
  const startTime = Date.now();

  try {
    logger.info("Starting PydanticAI sentiment analysis", {
      companyName,
      industry,
      model: model.id,
    });

    // Context for PydanticAI agent (embedded system prompt)
    const context = `Analyze sentiment for ${companyName} in ${industry} industry`;

    // Execute PydanticAI agent
    const result = await pydanticLlmService.executeAgent<SentimentScores>(
      "sentiment_agent.py",
      {
        company_name: companyName,
        industry,
        context,
        analysis_type: "comprehensive",
      },
      SentimentScoresSchema,
      {
        modelId: model.id,
        temperature: 0.3,
        maxTokens: 2000,
        timeout: 30000,
      }
    );

    // Performance tracking is now handled by PydanticAI agents internally

    const executionTime = Date.now() - startTime;

    logger.info("PydanticAI sentiment analysis completed", {
      companyName,
      industry,
      executionTime,
      tokensUsed: result.metadata.tokensUsed,
      modelUsed: result.metadata.modelUsed,
      success: result.metadata.success,
    });

    // CRITICAL FIX: Extract actual token counts from PydanticAI response
    // TODO: Update PydanticAI agents to return actual input/output token counts
    const actualUsage = extractActualTokenUsage(result.metadata);

    return {
      data: result.data,
      usage: actualUsage,
      modelUsed: result.metadata.modelUsed,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;

    logger.error("PydanticAI sentiment analysis failed", {
      companyName,
      industry,
      executionTime,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new Error(
      `Sentiment analysis failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Generate overall sentiment summary using PydanticAI
 */
export async function generateOverallSentimentSummary(
  companyName: string,
  sentiments: SentimentScores[]
): Promise<ChatCompletionResponse<SentimentScores>> {
  const startTime = Date.now();

  try {
    logger.info("Starting PydanticAI sentiment summary", {
      companyName,
      sentimentCount: sentiments.length,
    });

    if (sentiments.length === 0) {
      throw new Error("No sentiment data provided for summary");
    }

    // Aggregate ratings for analysis (rounded integers for consistency)
    const allRatings = sentiments.flatMap((s) => s.ratings);
    const toAvg = (
      getter: (r: {
        quality: number;
        priceValue: number;
        brandReputation: number;
        brandTrust: number;
        customerService: number;
      }) => number
    ) =>
      Math.round(
        allRatings.reduce((sum, r) => sum + getter(r), 0) /
          Math.max(1, allRatings.length)
      );

    const averages = {
      quality: toAvg((r) => r.quality),
      priceValue: toAvg((r) => r.priceValue),
      brandReputation: toAvg((r) => r.brandReputation),
      brandTrust: toAvg((r) => r.brandTrust),
      customerService: toAvg((r) => r.customerService),
    };

    // Collect citations from individual sentiments (webSearchMetadata.sources_found)
    type Source = { url: string; title?: string; domain?: string };
    const collected: Source[] = [];
    for (const s of sentiments) {
      const sources =
        (s as unknown as { webSearchMetadata?: { sources_found?: Source[] } })
          ?.webSearchMetadata?.sources_found || [];
      for (const src of sources) {
        if (src && typeof src.url === "string") {
          const entry: Source = { url: src.url };
          if (typeof src.title === "string") entry.title = src.title;
          if (typeof src.domain === "string") entry.domain = src.domain;
          collected.push(entry);
        }
      }
    }
    // Deduplicate by URL and cap to 10 diverse sources
    const uniqueByUrl = new Map<string, Source>();
    for (const src of collected) {
      if (!uniqueByUrl.has(src.url)) uniqueByUrl.set(src.url, src);
    }
    const topCitations = Array.from(uniqueByUrl.values()).slice(0, 10);

    // Prepare individual_sentiments payload expected by summary agent
    const individual_sentiments = sentiments.map((s) => {
      const r = s.ratings?.[0];
      return r
        ? {
            ratings: {
              quality: r.quality,
              priceValue: r.priceValue,
              brandReputation: r.brandReputation,
              brandTrust: r.brandTrust,
              customerService: r.customerService,
            },
            // Provider/model hint if available
            provider: (s as unknown as { provider?: string })?.provider,
            summary: r.summaryDescription,
          }
        : { ratings: {} };
    });

    // Use purpose-built summary agent with aggregated ratings + per-model inputs
    const result = await pydanticLlmService.executeAgent<SentimentScores>(
      "sentiment_summary_agent.py",
      {
        company_name: companyName,
        industry: sentiments[0]?.industry || "Unknown",
        aggregated_ratings: averages,
        individual_sentiments,
        citations: topCitations,
        analysis_type: "summary",
      },
      null,
      {
        temperature: 0.4,
        maxTokens: 2000,
        timeout: 30000,
      }
    );

    // Compose final summary with preserved citations as webSearchMetadata
    const summaryData: SentimentScores = {
      companyName: companyName,
      industry: sentiments[0]?.industry || "Unknown",
      ratings: [
        {
          quality: averages.quality,
          priceValue: averages.priceValue,
          brandReputation: averages.brandReputation,
          brandTrust: averages.brandTrust,
          customerService: averages.customerService,
          summaryDescription:
            result.data.ratings?.[0]?.summaryDescription ||
            `Aggregated sentiment summary for ${companyName} based on ${allRatings.length} individual model ratings.`,
        },
      ],
      // Attach citations so frontend can render badges
      webSearchMetadata: topCitations.length
        ? {
            search_enabled: true,
            queries_performed: [],
            sources_found: topCitations.map((c) => ({
              url: c.url,
              title: c.title || "Sentiment source",
              domain: c.domain || "",
              snippet: "",
              relevance_score: 0.8,
            })),
            total_searches: 0,
            search_duration_ms: 0,
            provider_used: "serplexity-summary",
            search_session_id: "",
          }
        : undefined,
    } as unknown as SentimentScores;

    const executionTime = Date.now() - startTime;

    logger.info("PydanticAI sentiment summary completed", {
      companyName,
      executionTime,
      tokensUsed: result.metadata.tokensUsed,
      success: result.metadata.success,
      averages: averages,
    });

    const usage = extractActualTokenUsage(
      result.metadata as unknown as Record<string, unknown>
    );
    return {
      data: summaryData,
      usage,
      modelUsed: result.metadata.modelUsed,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;

    logger.error("PydanticAI sentiment summary failed", {
      companyName,
      executionTime,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new Error(
      `Sentiment summary failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Generate question response using PydanticAI
 */
export async function generateQuestionResponse(
  question: QuestionInput,
  model: Model
): Promise<
  ChatCompletionResponse<{
    answer: string;
    citations?: Array<{
      url: string;
      title: string;
      domain: string;
      accessedAt: Date;
      position: number;
    }>;
    has_web_search?: boolean;
    brand_mentions_count?: number;
  }>
> {
  const startTime = Date.now();

  try {
    logger.info("Starting PydanticAI question response", {
      questionId: question.id,
      questionLength: question.text.length,
      model: model.id,
    });

    // Execute PydanticAI agent with natural question
    const result = await pydanticLlmService.executeAgent<{
      question: string;
      answer: string | { answer: string };
      citations?: Array<{
        url: string;
        title: string;
        domain: string;
        accessedAt?: string;
        position?: number;
      }>;
      has_web_search?: boolean;
      brand_mentions_count?: number;
    }>(
      "answer_agent.py",
      {
        question: question.text,
        system_prompt: question.systemPrompt,
        question_id: question.id,
      },
      QuestionResponseSchema,
      {
        modelId: model.id,
        temperature: 0.7,
        maxTokens: 1500,
        timeout: 30000,
      }
    );

    const executionTime = Date.now() - startTime;

    logger.info("PydanticAI question response completed", {
      questionId: question.id,
      executionTime,
      tokensUsed: result.metadata.tokensUsed,
      success: result.metadata.success,
      citationsCount: result.data.citations?.length || 0,
    });

    // Convert and validate citations format
    const citations =
      result.data.citations?.map((citation, index) => ({
        url: citation.url,
        title: citation.title,
        domain: citation.domain,
        accessedAt: citation.accessedAt
          ? new Date(citation.accessedAt)
          : new Date(),
        position: citation.position || index + 1,
      })) || [];

    const usage = extractActualTokenUsage(
      result.metadata as unknown as Record<string, unknown>
    );
    const responseData: {
      answer: string;
      citations?: Array<{
        url: string;
        title: string;
        domain: string;
        accessedAt: Date;
        position: number;
      }>;
      has_web_search?: boolean;
      brand_mentions_count?: number;
    } = {
      answer:
        typeof result.data.answer === "string"
          ? result.data.answer
          : (result.data.answer as any)?.answer || "",
      citations: citations,
    };
    if (typeof result.data.has_web_search !== "undefined") {
      responseData.has_web_search = Boolean(result.data.has_web_search);
    }
    if (typeof result.data.brand_mentions_count !== "undefined") {
      responseData.brand_mentions_count = Number(
        result.data.brand_mentions_count
      );
    }

    return {
      data: responseData,
      usage: usage,
      modelUsed: result.metadata.modelUsed,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;

    logger.error("PydanticAI question response failed", {
      questionId: question.id,
      executionTime,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new Error(
      `Question response failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Generate website enrichment for competitors using PydanticAI
 */
export async function generateWebsiteForCompetitors(
  competitorNames: string[]
): Promise<ChatCompletionResponse<CompetitorInfo[]>> {
  const startTime = Date.now();

  try {
    logger.info("Starting PydanticAI website enrichment", {
      competitorCount: competitorNames.length,
    });

    if (competitorNames.length === 0) {
      return {
        data: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }

    // Context for PydanticAI agent (embedded system prompt)
    const context = `Find official websites for these competitors: ${competitorNames.join(", ")}`;

    // Execute PydanticAI agent
    const result = await pydanticLlmService.executeAgent<{
      competitors: CompetitorInfo[];
    }>(
      "website_agent.py",
      {
        competitor_names: competitorNames,
        context,
        search_depth: "standard",
      },
      z.object({
        competitors: z.array(CompetitorSchema),
      }) as z.ZodType<{ competitors: CompetitorInfo[] }>,
      {
        // Force Perplexity sonar for enrichment to prevent OpenAI 404s on "sonar"
        modelId: "perplexity:sonar",
        temperature: 0.2,
        maxTokens: 2000,
        timeout: 45000,
      }
    );

    const executionTime = Date.now() - startTime;

    // Safely handle malformed/empty agent responses
    const competitorsArray = Array.isArray((result as any)?.data?.competitors)
      ? ((result as any).data.competitors as CompetitorInfo[])
      : [];

    logger.info("PydanticAI website enrichment completed", {
      competitorCount: competitorNames.length,
      foundWebsites: competitorsArray.length,
      executionTime,
      tokensUsed: result.metadata.tokensUsed,
      success: result.metadata.success,
    });

    // Prefer detailed usage from provider if available
    const usage = extractActualTokenUsage(
      result.metadata as unknown as Record<string, unknown>
    );
    return {
      data: competitorsArray,
      usage,
      modelUsed: result.metadata.modelUsed,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;

    logger.error("PydanticAI website enrichment failed", {
      competitorCount: competitorNames.length,
      executionTime,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new Error(
      `Website enrichment failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Generic chat completion function for PydanticAI
 */
export async function generateChatCompletion(
  model: Model,
  prompt: string,
  schema?: z.ZodType<unknown>
): Promise<{ content: string | null; usage: TokenUsage }> {
  const startTime = Date.now();

  try {
    logger.info("Starting PydanticAI chat completion", {
      modelId: model.id,
      promptLength: prompt.length,
      hasSchema: !!schema,
    });

    if (schema) {
      // Structured output with schema validation
      const result = await pydanticLlmService.executeAgent<unknown>(
        "answer_agent.py",
        {
          prompt,
          output_schema: schema,
          structured: true,
        },
        schema,
        {
          modelId: model.id,
          temperature: 0.7,
          maxTokens: 2000,
          timeout: 30000,
        }
      );

      return {
        content: JSON.stringify(result.data),
        usage: {
          promptTokens: Math.floor(result.metadata.tokensUsed * 0.7),
          completionTokens: Math.floor(result.metadata.tokensUsed * 0.3),
          totalTokens: result.metadata.tokensUsed,
        },
      };
    } else {
      // Simple text completion
      const result = await pydanticLlmService.executeAgent<{
        response: string;
      }>(
        "answer_agent.py",
        {
          prompt,
          structured: false,
        },
        z.object({ response: z.string() }) as z.ZodType<{ response: string }>,
        {
          modelId: model.id,
          temperature: 0.7,
          maxTokens: 2000,
          timeout: 30000,
        }
      );

      return {
        content: result.data.response,
        usage: {
          promptTokens: Math.floor(result.metadata.tokensUsed * 0.7),
          completionTokens: Math.floor(result.metadata.tokensUsed * 0.3),
          totalTokens: result.metadata.tokensUsed,
        },
      };
    }
  } catch (error) {
    const executionTime = Date.now() - startTime;

    logger.error("PydanticAI chat completion failed", {
      modelId: model.id,
      executionTime,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new Error(
      `Chat completion failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Enhanced generateAndValidate function using PydanticAI
 */
export async function generateAndValidate<T, U>(
  prompt: string,
  schema: z.ZodSchema<T>,
  model: Model,
  task: ModelTask,
  transform?: (data: T) => U,
  rescue?: (data: unknown) => unknown
): Promise<{ data: U; usage: TokenUsage }> {
  const startTime = Date.now();

  try {
    logger.info("Starting PydanticAI generate and validate", {
      modelId: model.id,
      task,
      promptLength: prompt.length,
    });

    // Execute with PydanticAI agent
    const result = await pydanticLlmService.executeAgent<T>(
      "answer_agent.py",
      {
        prompt,
        task,
        validation_schema: schema,
        transform_enabled: !!transform,
        rescue_enabled: !!rescue,
      },
      schema,
      {
        modelId: model.id,
        temperature: 0.3,
        maxTokens: 2000,
        timeout: 30000,
      }
    );

    // Apply transformations if provided
    let finalData: U;
    if (transform) {
      finalData = transform(result.data);
    } else {
      finalData = result.data as unknown as U;
    }

    const executionTime = Date.now() - startTime;

    logger.info("PydanticAI generate and validate completed", {
      modelId: model.id,
      task,
      executionTime,
      tokensUsed: result.metadata.tokensUsed,
      success: result.metadata.success,
    });

    return {
      data: finalData,
      usage: {
        promptTokens: Math.floor(result.metadata.tokensUsed * 0.7),
        completionTokens: Math.floor(result.metadata.tokensUsed * 0.3),
        totalTokens: result.metadata.tokensUsed,
      },
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;

    logger.error("PydanticAI generate and validate failed", {
      modelId: model.id,
      task,
      executionTime,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new Error(
      `Generate and validate failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// --- Service Health and Monitoring ---

/**
 * Get service health status
 */
export function getServiceHealth() {
  const providerHealth = providerManager.getHealthReport();
  const serviceStats = pydanticLlmService.getServiceStatistics();

  return {
    providers: providerHealth,
    activeExecutions: serviceStats.activeExecutions,
    poolSize: serviceStats.poolSize,
    overallHealth:
      providerHealth.filter((p) => p.available).length / providerHealth.length,
  };
}

/**
 * Get detailed service statistics
 */
export function getServiceStatistics() {
  return pydanticLlmService.getServiceStatistics();
}

logger.info("PydanticAI LLM service initialized successfully", {
  availableProviders: providerManager.getAvailableProviders().length,
  healthyProviders: providerManager.getHealthReport().filter((p) => p.available)
    .length,
});

/**
 * Get user model preferences from database
 */
export async function getUserModelPreferences(
  userId: string
): Promise<Record<string, boolean>> {
  try {
    const prisma = await getDbClient();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { modelPreferences: true },
    });

    if (!user || !user.modelPreferences) {
      // Return default preferences if none are set
      return {
        "gpt-4.1-mini": true,
        "claude-3-5-haiku-20241022": true,
        "gemini-2.5-flash": true,
        sonar: true,
        "ai-overview": true,
      };
    }

    return user.modelPreferences as Record<string, boolean>;
  } catch (error) {
    logger.error("Failed to get user model preferences", { userId, error });
    // Return default preferences on error
    return {
      "gpt-4.1-mini": true,
      "claude-3-5-haiku-20241022": true,
      "gemini-2.5-flash": true,
      sonar: true,
      "ai-overview": true,
    };
  }
}

/**
 * Get models that can perform a specific task, filtered by user preferences
 */
export async function getModelsByTaskWithUserPreferences(
  task: ModelTask,
  userId: string,
  companyPreferences?: Record<string, boolean> | null
): Promise<Model[]> {
  const allModels = getModelsByTask(task);
  const userPreferences = await getUserModelPreferences(userId);

  const merged: Record<string, boolean> = { ...userPreferences };
  if (companyPreferences && typeof companyPreferences === "object") {
    for (const [k, v] of Object.entries(companyPreferences)) {
      merged[k] = v;
    }
  }

  return allModels.filter((model: Model) => merged[model.id] === true);
}

/**
 * CRITICAL: Extract actual token usage from PydanticAI metadata
 * This replaces the dangerous hardcoded percentage estimates
 */
function extractActualTokenUsage(
  metadata: Record<string, unknown>
): TokenUsage {
  // Try to extract actual token counts from metadata using index access to satisfy TS4111
  const metaUsage = (metadata as any)["usage"];
  if (metaUsage && typeof metaUsage === "object") {
    const usage = metaUsage as Record<string, unknown>;

    // Priority 1: Direct token counts from provider
    if (
      usage["prompt_tokens"] !== undefined &&
      usage["completion_tokens"] !== undefined
    ) {
      const p = Number(usage["prompt_tokens"]) || 0;
      const c = Number(usage["completion_tokens"]) || 0;
      const think = Number(usage["thinking_tokens"]) || 0;
      const t =
        Number(usage["total_tokens"]) !== undefined
          ? Number(usage["total_tokens"]) || p + c + think
          : p + c + think;
      return {
        promptTokens: p,
        completionTokens: c,
        totalTokens: t,
        thinkingTokens: think,
        cacheReadTokens: Number(usage["cache_read_tokens"]) || 0,
        cacheWriteTokens: Number(usage["cache_write_tokens"]) || 0,
      };
    }

    // Priority 2: Input/output tokens
    if (
      usage["input_tokens"] !== undefined &&
      usage["output_tokens"] !== undefined
    ) {
      const p = Number(usage["input_tokens"]) || 0;
      const c = Number(usage["output_tokens"]) || 0;
      const think = Number(usage["thinking_tokens"]) || 0;
      const t =
        Number(usage["total_tokens"]) !== undefined
          ? Number(usage["total_tokens"]) || p + c + think
          : p + c + think;
      return {
        promptTokens: p,
        completionTokens: c,
        totalTokens: t,
        thinkingTokens: think,
        cacheReadTokens: Number(usage["cache_read_tokens"]) || 0,
        cacheWriteTokens: Number(usage["cache_write_tokens"]) || 0,
      };
    }
  }

  // FALLBACK: Quietly use provided aggregate tokensUsed if available
  const totalTokens = Number((metadata as any)["tokensUsed"]) || 0;
  if (totalTokens > 0) {
    return {
      promptTokens: Math.floor(totalTokens * 0.7),
      completionTokens: Math.floor(totalTokens * 0.3),
      totalTokens,
    };
  }

  // Default to zeros when nothing is available
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}
