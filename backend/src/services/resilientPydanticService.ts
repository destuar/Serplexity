/**
 * @file resilientPydanticService.ts
 * @description Resilient wrapper around PydanticLlmService with circuit breaker pattern
 * to prevent cascade failures in TypeScript→Python communication.
 *
 * @dependencies
 * - ./pydanticLlmService: Core PydanticAI service
 * - ./circuitBreakerService: Circuit breaker implementation
 * - ../utils/logger: Application logging
 *
 * @exports
 * - ResilientPydanticService: Main service class with resilience patterns
 * - resilientPydanticService: Singleton instance
 */

import { z } from "zod";
import logger from "../utils/logger";
import { circuitBreakerService } from "./circuitBreakerService";
import {
  PydanticAgentOptions,
  pydanticLlmService,
  PydanticResponse,
} from "./pydanticLlmService";

export interface ResilientExecutionOptions extends PydanticAgentOptions {
  fallbackEnabled?: boolean;
  circuitBreakerConfig?: {
    failureThreshold?: number;
    recoveryTimeout?: number;
    timeout?: number;
  };
}

export class ResilientPydanticService {
  private static instance: ResilientPydanticService;
  private readonly circuitNames = {
    QUESTION_AGENT: "pydantic-question-agent",
    ANSWER_AGENT: "pydantic-answer-agent",
    SENTIMENT_AGENT: "pydantic-sentiment-agent",
    SENTIMENT_SUMMARY_AGENT: "pydantic-sentiment-summary-agent",
    MENTION_AGENT: "pydantic-mention-agent",
    RESEARCH_AGENT: "pydantic-research-agent",
    WEBSITE_AGENT: "pydantic-website-agent",
    FANOUT_AGENT: "pydantic-fanout-agent",
    SEARCH_AGENT: "pydantic-search-agent",
  };

  private constructor() {
    this.initializeCircuitBreakers();
  }

  public static getInstance(): ResilientPydanticService {
    if (!ResilientPydanticService.instance) {
      ResilientPydanticService.instance = new ResilientPydanticService();
    }
    return ResilientPydanticService.instance;
  }

  /**
   * Initialize circuit breakers for all PydanticAI agents
   */
  private initializeCircuitBreakers(): void {
    for (const [agentType, circuitName] of Object.entries(this.circuitNames)) {
      circuitBreakerService.createCircuit(circuitName, {
        failureThreshold: 3,        // Open after 3 failures (Python processes can fail quickly)
        recoveryTimeout: 30000,     // 30 seconds recovery timeout
        monitoringWindow: 120000,   // 2 minute monitoring window
        successThreshold: 2,        // Need 2 successes to close
        timeout: 60000,             // 60 second timeout for Python agents
      });
      
      logger.info(`[ResilientPydantic] Initialized circuit breaker for agent: ${agentType}`);
    }
  }

  /**
   * Execute a question agent with circuit breaker protection
   */
  public async executeQuestionAgent<T>(
    inputData: unknown,
    outputSchema: z.ZodType<T> | null,
    options: ResilientExecutionOptions = {}
  ): Promise<PydanticResponse<T>> {
    return this.executeWithCircuitBreaker(
      this.circuitNames.QUESTION_AGENT,
      "question_agent",
      inputData,
      outputSchema,
      options
    );
  }

  /**
   * Execute an answer agent with circuit breaker protection
   */
  public async executeAnswerAgent<T>(
    inputData: unknown,
    outputSchema: z.ZodType<T> | null,
    options: ResilientExecutionOptions = {}
  ): Promise<PydanticResponse<T>> {
    return this.executeWithCircuitBreaker(
      this.circuitNames.ANSWER_AGENT,
      "answer_agent",
      inputData,
      outputSchema,
      options
    );
  }

  /**
   * Execute a sentiment agent with circuit breaker protection
   */
  public async executeSentimentAgent<T>(
    inputData: unknown,
    outputSchema: z.ZodType<T> | null,
    options: ResilientExecutionOptions = {}
  ): Promise<PydanticResponse<T>> {
    return this.executeWithCircuitBreaker(
      this.circuitNames.SENTIMENT_AGENT,
      "sentiment_agent",
      inputData,
      outputSchema,
      options
    );
  }

  /**
   * Execute a sentiment summary agent with circuit breaker protection
   */
  public async executeSentimentSummaryAgent<T>(
    inputData: unknown,
    outputSchema: z.ZodType<T> | null,
    options: ResilientExecutionOptions = {}
  ): Promise<PydanticResponse<T>> {
    return this.executeWithCircuitBreaker(
      this.circuitNames.SENTIMENT_SUMMARY_AGENT,
      "sentiment_summary_agent",
      inputData,
      outputSchema,
      options
    );
  }

  /**
   * Execute a mention agent with circuit breaker protection
   */
  public async executeMentionAgent<T>(
    inputData: unknown,
    outputSchema: z.ZodType<T> | null,
    options: ResilientExecutionOptions = {}
  ): Promise<PydanticResponse<T>> {
    return this.executeWithCircuitBreaker(
      this.circuitNames.MENTION_AGENT,
      "mention_agent",
      inputData,
      outputSchema,
      options
    );
  }

  /**
   * Execute a research agent with circuit breaker protection
   */
  public async executeResearchAgent<T>(
    inputData: unknown,
    outputSchema: z.ZodType<T> | null,
    options: ResilientExecutionOptions = {}
  ): Promise<PydanticResponse<T>> {
    return this.executeWithCircuitBreaker(
      this.circuitNames.RESEARCH_AGENT,
      "research_agent",
      inputData,
      outputSchema,
      options
    );
  }

  /**
   * Execute a website agent with circuit breaker protection
   */
  public async executeWebsiteAgent<T>(
    inputData: unknown,
    outputSchema: z.ZodType<T> | null,
    options: ResilientExecutionOptions = {}
  ): Promise<PydanticResponse<T>> {
    return this.executeWithCircuitBreaker(
      this.circuitNames.WEBSITE_AGENT,
      "website_agent",
      inputData,
      outputSchema,
      options
    );
  }

  /**
   * Execute a fanout agent with circuit breaker protection
   */
  public async executeFanoutAgent<T>(
    inputData: unknown,
    outputSchema: z.ZodType<T> | null,
    options: ResilientExecutionOptions = {}
  ): Promise<PydanticResponse<T>> {
    return this.executeWithCircuitBreaker(
      this.circuitNames.FANOUT_AGENT,
      "fanout_agent",
      inputData,
      outputSchema,
      options
    );
  }

  /**
   * Execute a search agent with circuit breaker protection
   */
  public async executeSearchAgent<T>(
    inputData: unknown,
    outputSchema: z.ZodType<T> | null,
    options: ResilientExecutionOptions = {}
  ): Promise<PydanticResponse<T>> {
    return this.executeWithCircuitBreaker(
      this.circuitNames.SEARCH_AGENT,
      "search_agent",
      inputData,
      outputSchema,
      options
    );
  }

  /**
   * Generic method to execute any agent with circuit breaker protection
   */
  public async executeAgent<T>(
    agentScript: string,
    inputData: unknown,
    outputSchema: z.ZodType<T> | null,
    options: ResilientExecutionOptions = {}
  ): Promise<PydanticResponse<T>> {
    // Map agent script to circuit name, fallback to generic circuit
    const circuitName = this.getCircuitNameForAgent(agentScript);
    
    return this.executeWithCircuitBreaker(
      circuitName,
      agentScript,
      inputData,
      outputSchema,
      options
    );
  }

  /**
   * Core method that wraps PydanticLlmService execution with circuit breaker
   */
  private async executeWithCircuitBreaker<T>(
    circuitName: string,
    agentScript: string,
    inputData: unknown,
    outputSchema: z.ZodType<T> | null,
    options: ResilientExecutionOptions
  ): Promise<PydanticResponse<T>> {
    const startTime = Date.now();
    
    // Update circuit breaker configuration if provided
    if (options.circuitBreakerConfig) {
      circuitBreakerService.createCircuit(circuitName, options.circuitBreakerConfig);
    }

    try {
      logger.debug(`[ResilientPydantic] Executing ${agentScript} via circuit ${circuitName}`);
      
      const result = await circuitBreakerService.execute(circuitName, async () => {
        return await pydanticLlmService.executeAgent(agentScript, inputData, outputSchema, options);
      });

      const duration = Date.now() - startTime;
      logger.info(`[ResilientPydantic] Successfully executed ${agentScript} (${duration}ms)`, {
        agentScript,
        circuitName,
        duration,
        hasResult: !!result.metadata.success,
      });

      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const isCircuitOpen = error instanceof Error && error.message.includes('Circuit breaker OPEN');
      
      logger.error(`[ResilientPydantic] Failed to execute ${agentScript} (${duration}ms)`, {
        agentScript,
        circuitName,
        duration,
        error: error instanceof Error ? error.message : error,
        isCircuitOpen,
      });

      // If circuit is open and fallback is enabled, try fallback
      if (isCircuitOpen && options.fallbackEnabled) {
        logger.warn(`[ResilientPydantic] Circuit is OPEN, attempting fallback for ${agentScript}`);
        return this.executeFallback(agentScript, inputData, outputSchema, options);
      }

      throw error;
    }
  }

  /**
   * Fallback execution when circuit breaker is open
   */
  private async executeFallback<T>(
    agentScript: string,
    _inputData: unknown,
    _outputSchema: z.ZodType<T> | null,
    _options: ResilientExecutionOptions
  ): Promise<PydanticResponse<T>> {
    logger.warn(`[ResilientPydantic] Executing fallback for ${agentScript} - returning graceful degradation`);
    
    // Return a graceful degradation response
    // The actual fallback logic would depend on the specific agent
    // For now, we return a failure response with circuit breaker information
    
    return {
      data: null as T,
      metadata: {
        modelUsed: "fallback",
        tokensUsed: 0,
        executionTime: 0,
        providerId: "fallback",
        success: false,
        attemptCount: 1,
        fallbackUsed: true,
        usage: {
          completion_tokens: 0,
          prompt_tokens: 0,
          total_tokens: 0,
        },
      },
    };
  }

  /**
   * Maps agent script names to circuit names
   */
  private getCircuitNameForAgent(agentScript: string): string {
    // Extract agent type from script name
    if (agentScript.includes('question')) return this.circuitNames.QUESTION_AGENT;
    if (agentScript.includes('answer')) return this.circuitNames.ANSWER_AGENT;
    if (agentScript.includes('sentiment_summary')) return this.circuitNames.SENTIMENT_SUMMARY_AGENT;
    if (agentScript.includes('sentiment')) return this.circuitNames.SENTIMENT_AGENT;
    if (agentScript.includes('mention')) return this.circuitNames.MENTION_AGENT;
    if (agentScript.includes('research')) return this.circuitNames.RESEARCH_AGENT;
    if (agentScript.includes('website')) return this.circuitNames.WEBSITE_AGENT;
    if (agentScript.includes('fanout')) return this.circuitNames.FANOUT_AGENT;
    if (agentScript.includes('search')) return this.circuitNames.SEARCH_AGENT;
    
    // Fallback to generic circuit
    const genericCircuit = `pydantic-${agentScript}`;
    circuitBreakerService.createCircuit(genericCircuit);
    return genericCircuit;
  }

  /**
   * Gets health status of all circuit breakers
   */
  public getHealthStatus(): {
    status: string;
    circuits: Record<string, any>;
    summary: {
      total: number;
      healthy: number;
      degraded: number;
      failed: number;
    };
  } {
    const _circuitHealth = circuitBreakerService.healthCheck();
    const allStats = circuitBreakerService.getAllStats();
    
    let healthy = 0;
    let degraded = 0;
    let failed = 0;
    
    for (const stats of Object.values(allStats)) {
      switch (stats.state) {
        case "CLOSED":
          healthy++;
          break;
        case "HALF_OPEN":
          degraded++;
          break;
        case "OPEN":
          failed++;
          break;
      }
    }
    
    const total = Object.keys(allStats).length;
    const overallStatus = failed > 0 ? "failed" : degraded > 0 ? "degraded" : "healthy";
    
    return {
      status: overallStatus,
      circuits: allStats,
      summary: {
        total,
        healthy,
        degraded,
        failed,
      },
    };
  }

  /**
   * Forces all circuits to close (for recovery operations)
   */
  public forceRecovery(): boolean {
    logger.warn(`[ResilientPydantic] Forcing recovery of all circuit breakers`);
    
    let success = true;
    for (const circuitName of Object.values(this.circuitNames)) {
      const result = circuitBreakerService.forceClose(circuitName);
      if (!result) {
        success = false;
      }
    }
    
    return success;
  }
}

// Export singleton instance
export const resilientPydanticService = ResilientPydanticService.getInstance();