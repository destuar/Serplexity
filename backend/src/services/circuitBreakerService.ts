/**
 * @file circuitBreakerService.ts
 * @description Circuit breaker implementation for preventing cascade failures
 * in TypeScript→Python communication and other critical service integrations.
 *
 * @dependencies
 * - ../utils/logger: Application logging
 *
 * @exports
 * - CircuitBreakerService: Main service class with circuit breaker operations
 * - CircuitBreakerConfig: Configuration interface
 * - CircuitState: Enumeration of circuit states
 */

import logger from "../utils/logger";

export enum CircuitState {
  CLOSED = "CLOSED",     // Normal operation
  OPEN = "OPEN",         // Failing fast, not attempting calls
  HALF_OPEN = "HALF_OPEN", // Testing if service has recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening
  recoveryTimeout: number;     // Time in ms before attempting recovery
  monitoringWindow: number;    // Time window for failure counting
  successThreshold: number;    // Successes needed to close from half-open
  timeout: number;             // Request timeout in ms
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  lastStateChange: number;
  windowStart: number;
}

export class CircuitBreakerService {
  private circuits = new Map<string, {
    config: CircuitBreakerConfig;
    stats: CircuitBreakerStats;
    failures: Array<{ timestamp: number; error: string }>;
  }>();

  private static readonly DEFAULT_CONFIG: CircuitBreakerConfig = {
    failureThreshold: 5,        // Open after 5 failures
    recoveryTimeout: 60000,     // 1 minute recovery timeout
    monitoringWindow: 300000,   // 5 minute monitoring window
    successThreshold: 3,        // Need 3 successes to close
    timeout: 30000,             // 30 second request timeout
  };

  /**
   * Creates or gets a circuit breaker for a service
   */
  public createCircuit(
    serviceName: string,
    config: Partial<CircuitBreakerConfig> = {}
  ): string {
    const finalConfig = { ...CircuitBreakerService.DEFAULT_CONFIG, ...config };
    const now = Date.now();
    
    if (!this.circuits.has(serviceName)) {
      this.circuits.set(serviceName, {
        config: finalConfig,
        stats: {
          state: CircuitState.CLOSED,
          failures: 0,
          successes: 0,
          totalRequests: 0,
          lastStateChange: now,
          windowStart: now,
        },
        failures: [],
      });
      
      logger.info(`[CircuitBreaker] Created circuit for service: ${serviceName}`, {
        config: finalConfig,
      });
    }
    
    return serviceName;
  }

  /**
   * Executes a function with circuit breaker protection
   */
  public async execute<T>(
    serviceName: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const circuit = this.circuits.get(serviceName);
    if (!circuit) {
      throw new Error(`Circuit breaker not found for service: ${serviceName}`);
    }

    const now = Date.now();
    this.cleanupOldFailures(circuit, now);
    
    // Check circuit state
    const state = this.getCurrentState(circuit, now);
    
    if (state === CircuitState.OPEN) {
      const error = new Error(`Circuit breaker OPEN for service: ${serviceName}`);
      logger.warn(`[CircuitBreaker] Request blocked - circuit is OPEN`, {
        serviceName,
        stats: circuit.stats,
      });
      throw error;
    }

    circuit.stats.totalRequests++;
    
    try {
      // Execute with timeout
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Circuit breaker timeout after ${circuit.config.timeout}ms`));
          }, circuit.config.timeout);
        }),
      ]);

      // Success
      this.recordSuccess(circuit, now);
      return result;
      
    } catch (error) {
      // Failure
      this.recordFailure(circuit, now, error);
      throw error;
    }
  }

  /**
   * Gets current circuit state with state transition logic
   */
  private getCurrentState(
    circuit: { config: CircuitBreakerConfig; stats: CircuitBreakerStats; failures: Array<{ timestamp: number; error: string }> },
    now: number
  ): CircuitState {
    const { config, stats } = circuit;
    
    switch (stats.state) {
      case CircuitState.CLOSED:
        // Check if we should open due to failures
        if (stats.failures >= config.failureThreshold) {
          this.transitionToOpen(circuit, now);
          return CircuitState.OPEN;
        }
        return CircuitState.CLOSED;
        
      case CircuitState.OPEN:
        // Check if recovery timeout has passed
        if (now - stats.lastStateChange >= config.recoveryTimeout) {
          this.transitionToHalfOpen(circuit, now);
          return CircuitState.HALF_OPEN;
        }
        return CircuitState.OPEN;
        
      case CircuitState.HALF_OPEN:
        // Check if we should close due to successes or open due to failures
        if (stats.successes >= config.successThreshold) {
          this.transitionToClosed(circuit, now);
          return CircuitState.CLOSED;
        }
        if (stats.failures > 0) {
          this.transitionToOpen(circuit, now);
          return CircuitState.OPEN;
        }
        return CircuitState.HALF_OPEN;
        
      default:
        return CircuitState.CLOSED;
    }
  }

  /**
   * Records a successful execution
   */
  private recordSuccess(
    circuit: { config: CircuitBreakerConfig; stats: CircuitBreakerStats },
    now: number
  ): void {
    circuit.stats.lastSuccessTime = now;
    
    if (circuit.stats.state === CircuitState.HALF_OPEN) {
      circuit.stats.successes++;
      logger.debug(`[CircuitBreaker] Success recorded in HALF_OPEN state`, {
        successes: circuit.stats.successes,
        threshold: circuit.config.successThreshold,
      });
    }
  }

  /**
   * Records a failed execution
   */
  private recordFailure(
    circuit: { config: CircuitBreakerConfig; stats: CircuitBreakerStats; failures: Array<{ timestamp: number; error: string }> },
    now: number,
    error: unknown
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    circuit.stats.lastFailureTime = now;
    circuit.stats.failures++;
    
    circuit.failures.push({
      timestamp: now,
      error: errorMessage,
    });
    
    // Reset successes on failure
    if (circuit.stats.state === CircuitState.HALF_OPEN) {
      circuit.stats.successes = 0;
    }
    
    logger.warn(`[CircuitBreaker] Failure recorded`, {
      error: errorMessage,
      currentFailures: circuit.stats.failures,
      threshold: circuit.config.failureThreshold,
      state: circuit.stats.state,
    });
  }

  /**
   * Transitions circuit to OPEN state
   */
  private transitionToOpen(
    circuit: { stats: CircuitBreakerStats },
    now: number
  ): void {
    logger.warn(`[CircuitBreaker] Circuit transitioning to OPEN`, {
      failures: circuit.stats.failures,
      previousState: circuit.stats.state,
    });
    
    circuit.stats.state = CircuitState.OPEN;
    circuit.stats.lastStateChange = now;
    circuit.stats.successes = 0; // Reset successes
  }

  /**
   * Transitions circuit to HALF_OPEN state
   */
  private transitionToHalfOpen(
    circuit: { stats: CircuitBreakerStats },
    now: number
  ): void {
    logger.info(`[CircuitBreaker] Circuit transitioning to HALF_OPEN - attempting recovery`, {
      previousState: circuit.stats.state,
    });
    
    circuit.stats.state = CircuitState.HALF_OPEN;
    circuit.stats.lastStateChange = now;
    circuit.stats.failures = 0; // Reset failure counter
    circuit.stats.successes = 0; // Reset success counter
  }

  /**
   * Transitions circuit to CLOSED state
   */
  private transitionToClosed(
    circuit: { stats: CircuitBreakerStats },
    now: number
  ): void {
    logger.info(`[CircuitBreaker] Circuit transitioning to CLOSED - service recovered`, {
      successes: circuit.stats.successes,
      previousState: circuit.stats.state,
    });
    
    circuit.stats.state = CircuitState.CLOSED;
    circuit.stats.lastStateChange = now;
    circuit.stats.failures = 0; // Reset counters
    circuit.stats.successes = 0;
  }

  /**
   * Cleans up old failures outside the monitoring window
   */
  private cleanupOldFailures(
    circuit: { config: CircuitBreakerConfig; stats: CircuitBreakerStats; failures: Array<{ timestamp: number; error: string }> },
    now: number
  ): void {
    const cutoffTime = now - circuit.config.monitoringWindow;
    
    // Remove old failures
    const oldFailureCount = circuit.failures.length;
    circuit.failures = circuit.failures.filter(f => f.timestamp > cutoffTime);
    
    // Update failure counter to reflect only recent failures
    circuit.stats.failures = circuit.failures.length;
    
    if (circuit.failures.length !== oldFailureCount) {
      logger.debug(`[CircuitBreaker] Cleaned up ${oldFailureCount - circuit.failures.length} old failures`, {
        remainingFailures: circuit.failures.length,
        windowStart: new Date(cutoffTime).toISOString(),
      });
    }
  }

  /**
   * Gets current statistics for a circuit
   */
  public getStats(serviceName: string): CircuitBreakerStats | null {
    const circuit = this.circuits.get(serviceName);
    if (!circuit) {
      return null;
    }
    
    const now = Date.now();
    this.cleanupOldFailures(circuit, now);
    
    return {
      ...circuit.stats,
      state: this.getCurrentState(circuit, now),
    };
  }

  /**
   * Gets statistics for all circuits
   */
  public getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    
    for (const [serviceName, circuit] of this.circuits) {
      const now = Date.now();
      this.cleanupOldFailures(circuit, now);
      stats[serviceName] = {
        ...circuit.stats,
        state: this.getCurrentState(circuit, now),
      };
    }
    
    return stats;
  }

  /**
   * Forces a circuit to open (for testing or emergency)
   */
  public forceOpen(serviceName: string): boolean {
    const circuit = this.circuits.get(serviceName);
    if (!circuit) {
      return false;
    }
    
    logger.warn(`[CircuitBreaker] Forcing circuit OPEN for service: ${serviceName}`);
    this.transitionToOpen(circuit, Date.now());
    return true;
  }

  /**
   * Forces a circuit to close (for testing or recovery)
   */
  public forceClose(serviceName: string): boolean {
    const circuit = this.circuits.get(serviceName);
    if (!circuit) {
      return false;
    }
    
    logger.info(`[CircuitBreaker] Forcing circuit CLOSED for service: ${serviceName}`);
    this.transitionToClosed(circuit, Date.now());
    return true;
  }

  /**
   * Health check for circuit breaker service
   */
  public healthCheck(): {
    status: string;
    circuits: Record<string, { state: CircuitState; failures: number }>;
  } {
    const circuits: Record<string, { state: CircuitState; failures: number }> = {};
    
    for (const [serviceName, circuit] of this.circuits) {
      const now = Date.now();
      const state = this.getCurrentState(circuit, now);
      circuits[serviceName] = {
        state,
        failures: circuit.stats.failures,
      };
    }
    
    const hasOpenCircuits = Object.values(circuits).some(c => c.state === CircuitState.OPEN);
    
    return {
      status: hasOpenCircuits ? "degraded" : "healthy",
      circuits,
    };
  }

  /**
   * Cleanup method for graceful shutdown
   */
  public cleanup(): void {
    logger.info(`[CircuitBreaker] Cleaning up ${this.circuits.size} circuits`);
    this.circuits.clear();
  }
}

// Export singleton instance
export const circuitBreakerService = new CircuitBreakerService();

// Cleanup on process exit
process.on('SIGTERM', () => circuitBreakerService.cleanup());
process.on('SIGINT', () => circuitBreakerService.cleanup());