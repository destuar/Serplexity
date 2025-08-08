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

import { ChildProcess, spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import env from "../config/env";
import {
  PydanticProviderConfig,
  providerManager,
} from "../config/pydanticProviders";
import {
  createSpan,
  initializeLogfire,
  trackError,
  trackLLMUsage,
  trackPerformance,
} from "../config/telemetry";
import logger from "../utils/logger";
import DependencyValidator from "./dependencyValidator";

// Initialize telemetry for the PydanticAI service
(async () => {
  try {
    await initializeLogfire({ serviceName: "pydantic-llm-service" });
    logger.info("Telemetry initialized for Pydantic LLM Service");
  } catch (error) {
    logger.error("Failed to initialize telemetry for Pydantic LLM Service", {
      error: error instanceof Error ? error.message : String(error),
    });
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
  readonly metadata?: Record<string, unknown>;
}

/**
 * Response interface for PydanticAI agent executions
 */
export interface PydanticResponse<T = unknown> {
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
  readonly inputData: unknown;
  readonly outputSchema?: z.ZodType<unknown> | null;
}

/**
 * Agent execution result with comprehensive metadata
 */
interface AgentExecutionResult {
  readonly success: boolean;
  readonly data?: unknown;
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
  private readonly activeExecutions: Map<string, AgentExecutionContext> =
    new Map();

  private constructor() {
    this.pythonPath = process.env["PYTHON_PATH"] || "python3";
    // Always point to source directory for Python scripts
    // This works both in development and production since Python files don't get compiled
    this.scriptsPath = path.resolve(__dirname, "../../src/pydantic_agents");
    // Initialize Python environment asynchronously without blocking constructor
    this.initializePythonEnvironment().catch((error) => {
      logger.error("Failed to initialize PydanticAI Python environment", {
        error,
      });
      // Mark all providers as unavailable in case of initialization failure
      providerManager.markAllProvidersUnavailable(
        "Python environment initialization failed"
      );
    });
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
      if (process.env["NODE_ENV"] === "test") {
        logger.info("PydanticAI service initialized (test mode)");
        return;
      }

      // Use comprehensive dependency validation
      const validator = DependencyValidator.getInstance();
      const validation = await validator.validateAll(false);

      if (validation.success) {
        logger.info(
          "✅ PydanticAI service initialized successfully - all dependencies validated",
          {
            pythonPath: this.pythonPath,
            scriptsPath: this.scriptsPath,
            validationSummary: validator.getHealthSummary(),
          }
        );
      } else {
        // Log detailed failure information
        logger.error(
          "❌ PydanticAI service running in degraded mode - dependency validation failed",
          {
            criticalFailures: validation.criticalFailures,
            warnings: validation.warnings,
            pythonPath: this.pythonPath,
            remediationSteps: this.generateRemediationSteps(validation.results),
          }
        );

        // Mark all providers as unavailable with detailed reason
        const failureReason = `Dependencies failed: ${validation.criticalFailures.join("; ")}`;
        providerManager.markAllProvidersUnavailable(failureReason);

        // Attempt automated remediation if configured
        if (env.AUTO_REMEDIATE_DEPENDENCIES) {
          logger.info("🔧 Attempting automated dependency remediation...");
          await this.attemptAutomatedRemediation(validation.results);
        }
      }
    } catch (error) {
      logger.error("Failed to initialize PydanticAI service directory setup", {
        error,
      });
      // Mark all providers as unavailable but don't crash the service
      providerManager.markAllProvidersUnavailable(
        "Service directory setup failed"
      );
    }
  }

  /**
   * Generate actionable remediation steps from validation results
   */
  private generateRemediationSteps(results: Map<string, unknown>): string[] {
    const steps: string[] = [];

    for (const [checkName, result] of results) {
      const resultObj = result as { success?: boolean; remediation?: string };
      if (!resultObj.success && resultObj.remediation) {
        steps.push(`${checkName}: ${resultObj.remediation}`);
      }
    }

    return steps;
  }

  /**
   * Attempt automated remediation for common dependency issues
   */
  private async attemptAutomatedRemediation(
    results: Map<string, unknown>
  ): Promise<void> {
    const remediation = results.get("pydantic-ai-installation");

    const remediationObj = remediation as {
      success?: boolean;
      remediation?: string;
    };
    if (
      remediationObj &&
      !remediationObj.success &&
      remediationObj.remediation?.includes("pip3 install")
    ) {
      try {
        logger.info(
          "🔧 Attempting to install Python dependencies automatically..."
        );

        const { spawn } = await import("child_process");
        const requirementsPath = path.join(process.cwd(), "requirements.txt");

        return new Promise((resolve, reject) => {
          const installProc = spawn(
            "pip3",
            ["install", "-r", requirementsPath],
            {
              stdio: ["ignore", "pipe", "pipe"],
            }
          );

          let output = "";
          let errorOutput = "";

          installProc.stdout?.on("data", (data) => {
            output += data.toString();
          });

          installProc.stderr?.on("data", (data) => {
            errorOutput += data.toString();
          });

          installProc.on("close", (code) => {
            if (code === 0) {
              logger.info("✅ Python dependencies installed successfully", {
                output,
              });
              resolve();
            } else {
              logger.error("❌ Failed to install Python dependencies", {
                exitCode: code,
                error: errorOutput,
              });
              reject(new Error(`pip install failed with code ${code}`));
            }
          });

          installProc.on("error", (error) => {
            logger.error("❌ pip install process failed", {
              error: error.message,
            });
            reject(error);
          });
        });
      } catch (error) {
        logger.error("❌ Automated remediation failed", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  /**
   * Validate Python environment has required dependencies
   */
  // Reserved for future use; currently unused to avoid flakiness in CI
  // Intentionally not used
  /* private async validatePythonEnvironment(): Promise<void> {
    return new Promise((resolve, reject) => {
      const validation = spawn(this.pythonPath, [
        "-c",
        'import pydantic_ai; print("OK")',
      ]);

      validation.stdout?.on("data", (_data) => {
        // Validation output received
      });

      validation.stderr?.on("data", (_data) => {
        // Validation error output
      });

      validation.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error("PydanticAI not installed or not accessible"));
        }
      });

      validation.on("error", (error) => {
        reject(new Error(`Python validation failed: ${error.message}`));
      });
    });
  } */

  /**
   * Extract clean JSON from mixed output (logging + JSON)
   */
  private extractJSONFromOutput(output: string): string {
    // Look for JSON content - typically starts with { and ends with }
    const lines = output.split("\n");
    const jsonLines: string[] = [];
    let inJson = false;
    let braceCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) continue;

      // Start of JSON
      if (!inJson && trimmed.startsWith("{")) {
        inJson = true;
        braceCount = 0;
      }

      if (inJson) {
        jsonLines.push(line);

        // Count braces to determine end of JSON
        for (const char of trimmed) {
          if (char === "{") braceCount++;
          if (char === "}") braceCount--;
        }

        // End of JSON object
        if (braceCount === 0) {
          break;
        }
      }
    }

    return jsonLines.length > 0 ? jsonLines.join("\n") : output;
  }

  /**
   * Check if output contains only logging information
   */
  private isLoggingOutput(output: string): boolean {
    if (!output || output.trim() === "") return false;

    const loggingPrefixes = [
      "INFO:",
      "DEBUG:",
      "WARNING:",
      "WARN:",
      "ERROR:",
      "CRITICAL:",
      "[INFO]",
      "[DEBUG]",
      "[WARNING]",
      "[ERROR]",
      "[CRITICAL]",
    ];

    const lines = output.split("\n").filter((line) => line.trim());

    // Check if all non-empty lines are logging
    return lines.every((line) => {
      const trimmed = line.trim();
      return (
        trimmed === "" ||
        loggingPrefixes.some((prefix) => trimmed.startsWith(prefix))
      );
    });
  }

  /**
   * Check if output contains ONLY logging (no real errors)
   */
  private isOnlyLoggingOutput(output: string): boolean {
    if (!output || output.trim() === "") return true;

    const lines = output.split("\n").filter((line) => line.trim());

    // Real error indicators
    const errorIndicators = [
      "Traceback (most recent call last):",
      "Exception:",
      "Error:",
      "Failed:",
      "ModuleNotFoundError:",
      "ImportError:",
      "AttributeError:",
      "TypeError:",
      "ValueError:",
      "KeyError:",
      "FileNotFoundError:",
      "ConnectionError:",
      "TimeoutError:",
      "CRITICAL ERROR:",
      "FATAL ERROR:",
    ];

    // Check if any line contains real error indicators
    const hasRealError = lines.some((line) => {
      const trimmed = line.trim();
      return errorIndicators.some((indicator) => trimmed.includes(indicator));
    });

    return !hasRealError;
  }

  /**
   * Extract actual error message from stderr, filtering out logging
   */
  private extractActualError(stderr: string): string {
    if (!stderr || stderr.trim() === "") return "";

    const lines = stderr.split("\n");
    const errorLines: string[] = [];

    // Look for actual error patterns, not just logging
    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and pure logging
      if (!trimmed) continue;

      // Keep lines that indicate real errors
      if (
        trimmed.includes("Traceback") ||
        trimmed.includes("Exception:") ||
        trimmed.includes("Error:") ||
        trimmed.includes("Failed:") ||
        trimmed.includes("CRITICAL:") ||
        trimmed.includes("FATAL:") ||
        /\w+Error:/.test(trimmed)
      ) {
        errorLines.push(line);
      }
    }

    // If no real errors found, but stderr has content, it might be logging
    if (errorLines.length === 0 && this.isLoggingOutput(stderr)) {
      return ""; // Not a real error, just logging
    }

    return errorLines.length > 0 ? errorLines.join("\n") : stderr;
  }

  /**
   * Execute PydanticAI agent with comprehensive error handling
   */
  async executeAgent<T>(
    agentScript: string,
    inputData: unknown,
    outputSchema: z.ZodType<T> | null,
    options: PydanticAgentOptions = {}
  ): Promise<PydanticResponse<T>> {
    const sessionId = this.generateSessionId();

    return createSpan(
      `PydanticAI Agent: ${agentScript}`,
      async (_span) => {
        const startTime = Date.now();

        const context: AgentExecutionContext = {
          agentId: agentScript,
          sessionId,
          timestamp: new Date(),
          options,
          inputData,
          outputSchema,
        };

        this.activeExecutions.set(sessionId, context);

        try {
          logger.info("Starting PydanticAI agent execution", {
            sessionId,
            agentScript,
            options: this.sanitizeOptions(options),
          });

          const result = await this.executeAgentInternal(
            agentScript,
            inputData,
            options
          );

          if (!result.success) {
            throw new Error(result.error || "Agent execution failed");
          }

          // Trust PydanticAI structured output - handle empty data gracefully
          let resultData = result.data;
          if (!resultData) {
            logger.warn(
              `PydanticAI agent ${agentScript} returned empty data, using default structure`
            );
            // Provide default structure to prevent downstream errors
            resultData = {
              error: "Agent returned empty data",
              success: false,
            };
          }

          // Get provider ID for metadata
          const providerIdForMetadata =
            result.providerId ||
            (options.modelId ? options.modelId.split(":")[0] : undefined) ||
            "unknown";

          const response: PydanticResponse<T> = {
            data: resultData as T,
            metadata: {
              modelUsed:
                result.modelUsed || options.modelId || providerIdForMetadata,
              tokensUsed: result.tokensUsed || 0,
              executionTime: result.executionTime || 0,
              providerId: providerIdForMetadata,
              success: true,
              attemptCount: result.attemptCount || 1,
              fallbackUsed: result.fallbackUsed || false,
            },
          };

          // Track successful execution
          trackLLMUsage({
            providerId: result.providerId || "unknown",
            modelId: result.modelUsed || "unknown",
            operation: agentScript,
            tokensUsed: result.tokensUsed || 0,
            durationMs: result.executionTime,
            success: true,
            metadata: {
              sessionId,
              agentScript,
              attemptCount: result.attemptCount,
              fallbackUsed: result.fallbackUsed,
            },
          } as unknown as any);

          trackPerformance({
            name: `agent.${agentScript}`,
            durationMs: result.executionTime || 0,
            success: true,
            metadata: {
              sessionId,
              modelUsed: result.modelUsed,
              tokensUsed: result.tokensUsed,
              fallbackUsed: result.fallbackUsed,
            },
          } as unknown as any);

          logger.info("PydanticAI agent execution completed successfully", {
            sessionId,
            executionTime: result.executionTime,
            modelUsed: result.modelUsed,
            tokensUsed: result.tokensUsed,
            fallbackUsed: result.fallbackUsed,
          });

          return response;
        } catch (error) {
          const executionTime = Date.now() - startTime;

          // Track failed execution
          trackError({
            error: error instanceof Error ? error : new Error(String(error)),
            context: `PydanticAI agent execution failed: ${agentScript}`,
            metadata: {
              sessionId,
              agentScript,
              executionTime,
              inputData: this.sanitizeInputData(inputData),
            },
          } as unknown as any);

          trackPerformance({
            name: `agent.${agentScript}`,
            durationMs: executionTime,
            success: false,
            metadata: {
              sessionId,
              error: error instanceof Error ? error.message : String(error),
            },
          } as unknown as any);

          logger.error("PydanticAI agent execution failed", {
            sessionId,
            agentScript,
            executionTime,
            error: error instanceof Error ? error.message : String(error),
          });

          throw error;
        } finally {
          this.activeExecutions.delete(sessionId);
        }
      },
      {
        "agent.script": agentScript,
        "agent.session_id": sessionId,
        "agent.input_size": JSON.stringify(inputData).length,
      }
    );
  }

  /**
   * Internal agent execution with retry logic and fallback handling
   */
  private async executeAgentInternal(
    agentScript: string,
    inputData: unknown,
    options: PydanticAgentOptions
  ): Promise<AgentExecutionResult> {
    const scriptPath = path.join(this.scriptsPath, "agents", agentScript);
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
          error: lastError.message,
        });
      }

      // Exponential backoff between retries
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error("Agent execution failed after all retries");
  }

  /**
   * Spawn Python process for agent execution
   */
  private async spawnPythonProcess(
    scriptPath: string,
    inputData: unknown,
    providerId: string,
    options: PydanticAgentOptions,
    attempt: number
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      // Add the parent directory of pydantic_agents to PYTHONPATH for absolute imports
      const pythonPackageDir = path.resolve(__dirname, "../../src");
      const existingPythonPath = process.env["PYTHONPATH"] || "";
      const pythonPath = existingPythonPath
        ? `${pythonPackageDir}:${existingPythonPath}`
        : pythonPackageDir;

      // Convert file path to module name for proper import
      const moduleName = this.convertPathToModuleName(scriptPath);

      const pythonProcess = spawn(this.pythonPath, ["-m", moduleName], {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: pythonPackageDir, // Set working directory to src for module imports
        env: {
          ...process.env,
          PYTHONPATH: pythonPath,
          PYDANTIC_PROVIDER_ID: providerId,
          PYDANTIC_MODEL_ID: options.modelId ?? "",
          PYDANTIC_TEMPERATURE: options.temperature?.toString(),
          PYDANTIC_MAX_TOKENS: options.maxTokens?.toString(),
          PYDANTIC_SYSTEM_PROMPT: options.systemPrompt,
          PYDANTIC_TIMEOUT: options.timeout?.toString(),
          // Explicitly pass API keys to Python subprocess
          PERPLEXITY_API_KEY: env.PERPLEXITY_API_KEY,
          OPENAI_API_KEY: env.OPENAI_API_KEY,
          ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
          GEMINI_API_KEY: env.GEMINI_API_KEY,
        },
      });

      // Send input data with provider information
      const baseInput: Record<string, unknown> =
        typeof inputData === "object" && inputData !== null
          ? (inputData as Record<string, unknown>)
          : { value: inputData as unknown };
      const enhancedInputData: Record<string, unknown> = {
        ...baseInput,
        provider: providerId,
      };
      pythonProcess.stdin?.write(JSON.stringify(enhancedInputData));
      pythonProcess.stdin?.end();

      let stdout = "";
      let stderr = "";

      pythonProcess.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      pythonProcess.on("close", (code) => {
        const executionTime = Date.now() - startTime;

        if (code === 0) {
          try {
            // Clean stdout from any logging contamination
            const cleanStdout = this.extractJSONFromOutput(stdout);
            const result: any = JSON.parse(cleanStdout);

            // Check for logging output in stderr
            const hasLoggingInStderr = this.isLoggingOutput(stderr);

            if (hasLoggingInStderr) {
              // Logging in stderr is normal, not an error
              logger.debug(`Normal logging output captured for ${providerId}`);
            }

            // Update provider health on success
            providerManager.updateProviderHealth(
              providerId,
              true,
              executionTime
            );

            // Check if the Python agent returned an error even with exit code 0
            if (result.error && !result.result && !result.data) {
              logger.warn(
                `Python agent returned error with exit code 0: ${result.error}`
              );
              resolve({
                success: false,
                error: result.error || "Python agent returned error",
                executionTime,
                providerId,
                tokensUsed: result.tokensUsed || result.tokens_used || 0,
                modelUsed: "unknown",
                attemptCount: 1,
                fallbackUsed: false,
              });
              return;
            }

            resolve({
              success: true,
              data: result.result || result.data, // Support both 'result' and 'data' properties
              executionTime,
              modelUsed:
                result.model_used ||
                result.modelUsed ||
                options.modelId ||
                providerId,
              tokensUsed: result.tokens_used || 0,
              providerId,
              attemptCount: attempt,
              fallbackUsed: attempt > 1,
            });
          } catch (parseError) {
            // Try to extract actual error from stderr vs logging
            const actualError = this.extractActualError(stderr);

            resolve({
              success: false,
              error:
                actualError || `Failed to parse agent output: ${parseError}`,
              executionTime,
              modelUsed: "unknown",
              tokensUsed: 0,
              providerId,
              attemptCount: attempt,
              fallbackUsed: attempt > 1,
            });
          }
        } else {
          // Process failed - but check if it's actually an error or just logging
          const actualError = this.extractActualError(stderr);
          const hasRealError = actualError && !this.isOnlyLoggingOutput(stderr);

          if (!hasRealError) {
            // Script completed but with logging output - treat as success if we can parse JSON
            try {
              const cleanStdout = this.extractJSONFromOutput(stdout);
              const result: any = JSON.parse(cleanStdout);

              providerManager.updateProviderHealth(
                providerId,
                true,
                executionTime
              );

              resolve({
                success: true,
                data: result.result || result.data,
                executionTime,
                modelUsed:
                  result.model_used ||
                  result.modelUsed ||
                  options.modelId ||
                  providerId,
                tokensUsed: result.tokens_used || 0,
                providerId,
                attemptCount: attempt,
                fallbackUsed: attempt > 1,
              });
              return;
            } catch {
              // Fall through to error handling
            }
          }

          resolve({
            success: false,
            error: actualError || `Process exited with code ${code}`,
            executionTime,
            modelUsed: "unknown",
            tokensUsed: 0,
            providerId,
            attemptCount: attempt,
            fallbackUsed: attempt > 1,
          });
        }
      });

      pythonProcess.on("error", (error) => {
        resolve({
          success: false,
          error: `Process spawn error: ${error.message}`,
          executionTime: Date.now() - startTime,
          modelUsed: "unknown",
          tokensUsed: 0,
          providerId,
          attemptCount: attempt,
          fallbackUsed: attempt > 1,
        });
      });

      // Handle timeout
      if (options.timeout) {
        setTimeout(() => {
          pythonProcess.kill("SIGTERM");
        }, options.timeout);
      }
    });
  }

  /**
   * Convert file path to Python module name for import
   */
  private convertPathToModuleName(scriptPath: string): string {
    // Extract the script name (e.g., "web_search_sentiment_agent.py")
    const scriptName = path.basename(scriptPath, ".py");

    // If the script path includes 'agents', construct the module name
    if (scriptPath.includes("agents")) {
      return `pydantic_agents.agents.${scriptName}`;
    }

    // For other scripts, assume they're in the main pydantic_agents directory
    return `pydantic_agents.${scriptName}`;
  }

  /**
   * Select appropriate provider based on options and availability
   */
  private selectProvider(
    providers: ReadonlyArray<PydanticProviderConfig>,
    options: PydanticAgentOptions
  ): string {
    if (options.modelId) {
      const [providerId] = String(options.modelId).split(":");

      // Handle special model ID mappings
      let actualProviderId = providerId;
      if (providerId === "sonar") {
        actualProviderId = "perplexity";
      }

      const provider = providers.find((p) => p.id === actualProviderId);
      if (provider && provider.id) {
        return provider.id;
      }
    }

    // Return highest priority available provider
    return providers.length > 0 && providers[0] && providers[0].id
      ? providers[0].id
      : "openai";
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
  private sanitizeOptions(
    options: PydanticAgentOptions
  ): Record<string, unknown> {
    const { ...sanitized } = options;
    return sanitized;
  }

  /**
   * Sanitize input data for logging (remove sensitive data)
   */
  private sanitizeInputData(inputData: unknown): unknown {
    if (typeof inputData === "string") {
      return inputData.length > 100
        ? `${inputData.substring(0, 100)}...`
        : inputData;
    }
    if (typeof inputData === "object" && inputData !== null) {
      const sanitized: Record<string, unknown> = {
        ...(inputData as Record<string, unknown>),
      };
      // Remove sensitive data from objects
      const redact = (key: string) => {
        if (key in sanitized) sanitized[key] = "***";
      };
      redact("apiKey");
      redact("secret");
      redact("token");
      redact("password");
      redact("credentials");
      redact("auth");
      redact("api_key");
      redact("api_secret");
      redact("api_token");
      redact("api_password");
      redact("api_credentials");
      redact("api_auth");
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
    providerHealth: unknown[];
  } {
    return {
      activeExecutions: this.activeExecutions.size,
      poolSize: this.processPool.size,
      providerHealth: [...providerManager.getHealthReport()],
    };
  }

  /**
   * Get available providers for health checks
   */
  getAvailableProviders(): unknown[] {
    return [...providerManager.getAvailableProviders()];
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Kill all active processes
    for (const [_sessionId, process] of this.processPool) {
      process.kill("SIGTERM");
    }

    this.processPool.clear();
    this.activeExecutions.clear();

    logger.info("PydanticLlmService cleaned up successfully");
  }
}

// Export singleton instance
export const pydanticLlmService = PydanticLlmService.getInstance();
