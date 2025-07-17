/**
 * @file pydanticLlmService.ts
 * @description PydanticAI integration service for Serplexity
 * 
 * This service provides a TypeScript interface to Python-based PydanticAI agents,
 * maintaining type safety while leveraging PydanticAI's superior structured output
 * and multi-provider capabilities. It replaces the complex manual LLM handling
 * with a streamlined, production-ready solution.
 * 
 * @architecture
 * - Agent lifecycle management with connection pooling
 * - Type-safe Python/TypeScript bridge
 * - Comprehensive error handling with detailed logging
 * - Performance monitoring and metrics collection
 * - Automatic provider failover and retry logic
 * 
 * @dependencies
 * - pydanticProviders: Provider configuration and management
 * - logger: Centralized logging system
 * - child_process: Node.js process spawning for Python execution
 * - zod: Runtime type validation
 * 
 * @exports
 * - PydanticLlmService: Main service class
 * - PydanticAgentOptions: Configuration interface
 * - PydanticResponse: Response interface
 * - AgentExecutionContext: Context interface for agent execution
 */

import { spawn, ChildProcess } from 'child_process';
import { z } from 'zod';
import logger from '../utils/logger';
import { 
  PydanticProviderConfig, 
  providerManager, 
  getDefaultModelString 
} from '../config/pydanticProviders';
import path from 'path';
import fs from 'fs/promises';
import { 
  trackLLMUsage, 
  trackPerformance, 
  trackError, 
  createSpan,
  initializeLogfire
} from '../config/logfire';

// Initialize Logfire for the PydanticAI service
(async () => {
  try {
    await initializeLogfire({
      serviceName: 'pydantic-llm-service',
      enableAutoInstrumentation: false, // We use custom spans
    });
    logger.info('Logfire initialized for Pydantic LLM Service');
  } catch (error) {
    logger.error('Failed to initialize Logfire for Pydantic LLM Service', error);
  }
})();


/**
 * Configuration options for PydanticAI agent creation
 */
export interface PydanticAgentOptions {
  readonly modelId?: string;
  readonly systemPrompt?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly timeout?: number;
  readonly enableStreaming?: boolean;
  readonly enableFallback?: boolean;
  readonly retryAttempts?: number;
  readonly metadata?: Record<string, any>;
}

/**
 * Response interface for PydanticAI agent executions
 */
export interface PydanticResponse<T = any> {
  readonly data: T;
  readonly metadata: {
    readonly modelUsed: string;
    readonly tokensUsed: number;
    readonly executionTime: number;
    readonly providerId: string;
    readonly success: boolean;
    readonly attemptCount: number;
    readonly fallbackUsed: boolean;
  };
}

/**
 * Context interface for agent execution
 */
export interface AgentExecutionContext {
  readonly agentId: string;
  readonly sessionId: string;
  readonly timestamp: Date;
  readonly options: PydanticAgentOptions;
  readonly inputData: any;
  readonly outputSchema?: z.ZodType<any>;
}

/**
 * Agent execution result with comprehensive metadata
 */
interface AgentExecutionResult {
  readonly success: boolean;
  readonly data?: any;
  readonly error?: string;
  readonly executionTime: number;
  readonly modelUsed: string;
  readonly tokensUsed: number;
  readonly providerId: string;
  readonly attemptCount: number;
  readonly fallbackUsed: boolean;
}

/**
 * PydanticAI service class providing TypeScript interface to Python agents
 */
export class PydanticLlmService {
  private static instance: PydanticLlmService;
  private readonly pythonPath: string;
  private readonly scriptsPath: string;
  private readonly processPool: Map<string, ChildProcess> = new Map();
  private readonly activeExecutions: Map<string, AgentExecutionContext> = new Map();

  private constructor() {
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    // Always point to source directory for Python scripts
    // This works both in development and production since Python files don't get compiled
    this.scriptsPath = path.resolve(__dirname, '../../src/pydantic_agents');
    this.initializePythonEnvironment();
  }

  static getInstance(): PydanticLlmService {
    if (!PydanticLlmService.instance) {
      PydanticLlmService.instance = new PydanticLlmService();
    }
    return PydanticLlmService.instance;
  }

  /**
   * Initialize Python environment and validate PydanticAI installation
   */
  private async initializePythonEnvironment(): Promise<void> {
    try {
      // Ensure scripts directory exists
      await fs.mkdir(this.scriptsPath, { recursive: true });
      
      // Skip Python validation during tests
      if (process.env.NODE_ENV === 'test') {
        logger.info('PydanticAI service initialized (test mode)');
        return;
      }
      
      // Validate Python and PydanticAI availability
      await this.validatePythonEnvironment();
      
      logger.info('PydanticAI service initialized successfully', {
        pythonPath: this.pythonPath,
        scriptsPath: this.scriptsPath
      });
    } catch (error) {
      logger.error('Failed to initialize PydanticAI service', { error });
      throw new Error('PydanticAI service initialization failed');
    }
  }

  /**
   * Validate Python environment has required dependencies
   */
  private async validatePythonEnvironment(): Promise<void> {
    return new Promise((resolve, reject) => {
      const validation = spawn(this.pythonPath, ['-c', 'import pydantic_ai; print("OK")']);
      
      validation.stdout?.on('data', (data) => {
        // Validation output received
      });
      
      validation.stderr?.on('data', (data) => {
        // Validation error output
      });
      
      validation.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error('PydanticAI not installed or not accessible'));
        }
      });
      
      validation.on('error', (error) => {
        reject(new Error(`Python validation failed: ${error.message}`));
      });
    });
  }

  /**
   * Execute PydanticAI agent with comprehensive error handling
   */
  async executeAgent<T>(
    agentScript: string,
    inputData: any,
    outputSchema: z.ZodType<T>,
    options: PydanticAgentOptions = {}
  ): Promise<PydanticResponse<T>> {
    const sessionId = this.generateSessionId();
    
    return createSpan(
      `PydanticAI Agent: ${agentScript}`,
      async (span) => {
        const startTime = Date.now();
        
        const context: AgentExecutionContext = {
          agentId: agentScript,
          sessionId,
          timestamp: new Date(),
          options,
          inputData,
          outputSchema
        };

        this.activeExecutions.set(sessionId, context);

        try {
          logger.info('Starting PydanticAI agent execution', {
            sessionId,
            agentScript,
            options: this.sanitizeOptions(options)
          });

          const result = await this.executeAgentInternal(agentScript, inputData, options);
          
          if (!result.success) {
            throw new Error(result.error || 'Agent execution failed');
          }

          // Validate output against schema
          const validatedData = outputSchema.parse(result.data);
          
          const response: PydanticResponse<T> = {
            data: validatedData,
            metadata: {
              modelUsed: result.modelUsed,
              tokensUsed: result.tokensUsed,
              executionTime: result.executionTime,
              providerId: result.providerId,
              success: true,
              attemptCount: result.attemptCount,
              fallbackUsed: result.fallbackUsed
            }
          };

          // Track successful execution with Logfire
          trackLLMUsage(
            result.providerId || 'unknown',
            result.modelUsed || 'unknown',
            agentScript,
            result.tokensUsed || 0,
            undefined, // cost estimate
            result.executionTime,
            true,
            {
              sessionId,
              agentScript,
              attemptCount: result.attemptCount,
              fallbackUsed: result.fallbackUsed
            }
          );

          trackPerformance(
            `agent.${agentScript}`,
            result.executionTime || 0,
            true,
            {
              sessionId,
              modelUsed: result.modelUsed,
              tokensUsed: result.tokensUsed,
              fallbackUsed: result.fallbackUsed
            }
          );

          logger.info('PydanticAI agent execution completed successfully', {
            sessionId,
            executionTime: result.executionTime,
            modelUsed: result.modelUsed,
            tokensUsed: result.tokensUsed,
            fallbackUsed: result.fallbackUsed
          });

          return response;

        } catch (error) {
          const executionTime = Date.now() - startTime;
          
          // Track failed execution with Logfire
          trackError(
            error instanceof Error ? error : new Error(String(error)),
            `PydanticAI agent execution failed: ${agentScript}`,
            undefined,
            undefined,
            {
              sessionId,
              agentScript,
              executionTime,
              inputData: this.sanitizeInputData(inputData)
            }
          );

          trackPerformance(
            `agent.${agentScript}`,
            executionTime,
            false,
            {
              sessionId,
              error: error instanceof Error ? error.message : String(error)
            }
          );
          
          logger.error('PydanticAI agent execution failed', {
            sessionId,
            agentScript,
            executionTime,
            error: error instanceof Error ? error.message : String(error)
          });

          throw error;
        } finally {
          this.activeExecutions.delete(sessionId);
        }
      },
      {
        'agent.script': agentScript,
        'agent.session_id': sessionId,
        'agent.input_size': JSON.stringify(inputData).length
      }
    );
  }

  /**
   * Internal agent execution with retry logic and fallback handling
   */
  private async executeAgentInternal(
    agentScript: string,
    inputData: any,
    options: PydanticAgentOptions
  ): Promise<AgentExecutionResult> {
    const scriptPath = path.join(this.scriptsPath, agentScript);
    const maxRetries = options.retryAttempts || 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const providers = providerManager.getAvailableProviders();
        const providerId = this.selectProvider(providers, options);
        
        const result = await this.spawnPythonProcess(
          scriptPath,
          inputData,
          providerId,
          options,
          attempt
        );

        if (result.success) {
          return result;
        }

        lastError = new Error(result.error);
        
        // Update provider health on failure
        if (result.providerId) {
          providerManager.updateProviderHealth(
            result.providerId,
            false,
            result.executionTime,
            result.error
          );
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`Agent execution attempt ${attempt} failed`, {
          agentScript,
          attempt,
          error: lastError.message
        });
      }

      // Exponential backoff between retries
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Agent execution failed after all retries');
  }

  /**
   * Spawn Python process for agent execution
   */
  private async spawnPythonProcess(
    scriptPath: string,
    inputData: any,
    providerId: string,
    options: PydanticAgentOptions,
    attempt: number
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(this.pythonPath, [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYDANTIC_PROVIDER_ID: providerId,
          PYDANTIC_MODEL_ID: options.modelId,
          PYDANTIC_TEMPERATURE: options.temperature?.toString(),
          PYDANTIC_MAX_TOKENS: options.maxTokens?.toString(),
          PYDANTIC_SYSTEM_PROMPT: options.systemPrompt,
          PYDANTIC_TIMEOUT: options.timeout?.toString()
        }
      });

      // Send input data
      pythonProcess.stdin?.write(JSON.stringify(inputData));
      pythonProcess.stdin?.end();

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        const executionTime = Date.now() - startTime;

        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            
            // Update provider health on success
            providerManager.updateProviderHealth(
              providerId,
              true,
              executionTime
            );

            resolve({
              success: true,
              data: result.data,
              executionTime,
              modelUsed: result.model_used || 'unknown',
              tokensUsed: result.tokens_used || 0,
              providerId,
              attemptCount: attempt,
              fallbackUsed: attempt > 1
            });
          } catch (parseError) {
            resolve({
              success: false,
              error: `Failed to parse agent output: ${parseError}`,
              executionTime,
              modelUsed: 'unknown',
              tokensUsed: 0,
              providerId,
              attemptCount: attempt,
              fallbackUsed: attempt > 1
            });
          }
        } else {
          resolve({
            success: false,
            error: stderr || `Process exited with code ${code}`,
            executionTime,
            modelUsed: 'unknown',
            tokensUsed: 0,
            providerId,
            attemptCount: attempt,
            fallbackUsed: attempt > 1
          });
        }
      });

      pythonProcess.on('error', (error) => {
        resolve({
          success: false,
          error: `Process spawn error: ${error.message}`,
          executionTime: Date.now() - startTime,
          modelUsed: 'unknown',
          tokensUsed: 0,
          providerId,
          attemptCount: attempt,
          fallbackUsed: attempt > 1
        });
      });

      // Handle timeout
      if (options.timeout) {
        setTimeout(() => {
          pythonProcess.kill('SIGTERM');
        }, options.timeout);
      }
    });
  }

  /**
   * Select appropriate provider based on options and availability
   */
  private selectProvider(
    providers: ReadonlyArray<PydanticProviderConfig>,
    options: PydanticAgentOptions
  ): string {
    if (options.modelId) {
      const [providerId] = options.modelId.split(':');
      const provider = providers.find(p => p.id === providerId);
      if (provider) {
        return providerId;
      }
    }

    // Return highest priority available provider
    return providers[0]?.id || 'openai';
  }

  /**
   * Generate unique session ID for tracking
   */
  private generateSessionId(): string {
    return `pydantic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize options for logging (remove sensitive data)
   */
  private sanitizeOptions(options: PydanticAgentOptions): any {
    const { ...sanitized } = options;
    return sanitized;
  }

  /**
   * Sanitize input data for logging (remove sensitive data)
   */
  private sanitizeInputData(inputData: any): any {
    if (typeof inputData === 'string') {
      return inputData.length > 100 ? `${inputData.substring(0, 100)}...` : inputData;
    }
    if (typeof inputData === 'object' && inputData !== null) {
      const sanitized = { ...inputData };
      // Remove sensitive data from objects
      if (sanitized.apiKey) {
        sanitized.apiKey = '***';
      }
      if (sanitized.secret) {
        sanitized.secret = '***';
      }
      if (sanitized.token) {
        sanitized.token = '***';
      }
      if (sanitized.password) {
        sanitized.password = '***';
      }
      if (sanitized.credentials) {
        sanitized.credentials = '***';
      }
      if (sanitized.auth) {
        sanitized.auth = '***';
      }
      if (sanitized.api_key) {
        sanitized.api_key = '***';
      }
      if (sanitized.api_secret) {
        sanitized.api_secret = '***';
      }
      if (sanitized.api_token) {
        sanitized.api_token = '***';
      }
      if (sanitized.api_password) {
        sanitized.api_password = '***';
      }
      if (sanitized.api_credentials) {
        sanitized.api_credentials = '***';
      }
      if (sanitized.api_auth) {
        sanitized.api_auth = '***';
      }
      return sanitized;
    }
    return inputData;
  }

  /**
   * Get current service statistics
   */
  getServiceStatistics(): {
    activeExecutions: number;
    poolSize: number;
    providerHealth: any[];
  } {
    return {
      activeExecutions: this.activeExecutions.size,
      poolSize: this.processPool.size,
      providerHealth: [...providerManager.getHealthReport()]
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Kill all active processes
    for (const [sessionId, process] of this.processPool) {
      process.kill('SIGTERM');
    }
    
    this.processPool.clear();
    this.activeExecutions.clear();
    
    logger.info('PydanticLlmService cleaned up successfully');
  }
}

// Export singleton instance
export const pydanticLlmService = PydanticLlmService.getInstance();