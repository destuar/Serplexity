/**
 * @file resourceMonitoringService.ts
 * @description Resource monitoring service for tracking memory usage, CPU utilization,
 * and enforcing limits on worker processes to prevent system overload.
 *
 * @dependencies
 * - ../utils/logger: Application logging
 *
 * @exports
 * - ResourceMonitoringService: Main service class with resource monitoring
 * - resourceMonitoringService: Singleton instance
 */

import logger from "../utils/logger";

export interface ResourceLimits {
  maxMemoryMB: number;
  maxExecutionTimeMs: number;
  warningMemoryMB?: number;
  warningExecutionTimeMs?: number;
}

export interface ResourceUsage {
  memoryMB: number;
  cpuPercent: number;
  executionTimeMs: number;
  heapUsedMB: number;
  heapTotalMB: number;
  external: number;
}

export interface ResourceMonitorResult {
  usage: ResourceUsage;
  withinLimits: boolean;
  warnings: string[];
  errors: string[];
}

export class ResourceMonitoringService {
  private static readonly DEFAULT_LIMITS: ResourceLimits = {
    maxMemoryMB: 2048, // 2GB memory limit
    maxExecutionTimeMs: 1800000, // 30 minutes
    warningMemoryMB: 1536, // 1.5GB warning threshold
    warningExecutionTimeMs: 1200000, // 20 minutes warning
  };

  private activeMonitors = new Map<string, {
    startTime: number;
    intervalId: NodeJS.Timeout;
    limits: ResourceLimits;
    callback: (result: ResourceMonitorResult) => void;
  }>();

  /**
   * Starts monitoring resources for a specific job/task
   * @param jobId - Unique identifier for the job being monitored
   * @param limits - Resource limits to enforce
   * @param callback - Function to call when limits are exceeded or warnings triggered
   * @returns Monitoring session ID
   */
  public startMonitoring(
    jobId: string,
    limits: Partial<ResourceLimits> = {},
    callback?: (result: ResourceMonitorResult) => void
  ): string {
    const finalLimits = { ...ResourceMonitoringService.DEFAULT_LIMITS, ...limits };
    const startTime = Date.now();
    
    logger.info(`[ResourceMonitor] Starting monitoring for job: ${jobId}`, {
      limits: finalLimits,
    });

    // Monitor every 10 seconds
    const intervalId = setInterval(() => {
      const result = this.checkResources(jobId, startTime, finalLimits);
      
      if (callback && (result.warnings.length > 0 || result.errors.length > 0 || !result.withinLimits)) {
        callback(result);
      }
      
      if (result.errors.length > 0) {
        logger.error(`[ResourceMonitor] Resource limits exceeded for job ${jobId}:`, result);
      } else if (result.warnings.length > 0) {
        logger.warn(`[ResourceMonitor] Resource warnings for job ${jobId}:`, result);
      }
    }, 10000); // Check every 10 seconds

    this.activeMonitors.set(jobId, {
      startTime,
      intervalId,
      limits: finalLimits,
      callback: callback || (() => {}),
    });

    return jobId;
  }

  /**
   * Stops monitoring for a specific job
   * @param jobId - Job identifier to stop monitoring
   */
  public stopMonitoring(jobId: string): void {
    const monitor = this.activeMonitors.get(jobId);
    if (monitor) {
      clearInterval(monitor.intervalId);
      this.activeMonitors.delete(jobId);
      
      const duration = Date.now() - monitor.startTime;
      logger.info(`[ResourceMonitor] Stopped monitoring job: ${jobId} (duration: ${duration}ms)`);
    }
  }

  /**
   * Checks current resource usage against limits
   * @param jobId - Job identifier for logging
   * @param startTime - Job start time for execution duration calculation
   * @param limits - Resource limits to check against
   * @returns Resource monitoring result
   */
  public checkResources(
    jobId: string,
    startTime: number,
    limits: ResourceLimits
  ): ResourceMonitorResult {
    const memoryUsage = process.memoryUsage();
    const executionTime = Date.now() - startTime;
    
    const usage: ResourceUsage = {
      memoryMB: Math.round(memoryUsage.rss / 1024 / 1024),
      heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      external: memoryUsage.external,
      cpuPercent: this.getCpuUsage(),
      executionTimeMs: executionTime,
    };

    const warnings: string[] = [];
    const errors: string[] = [];
    let withinLimits = true;

    // Check memory limits
    if (usage.memoryMB > limits.maxMemoryMB) {
      errors.push(`Memory usage ${usage.memoryMB}MB exceeds limit ${limits.maxMemoryMB}MB`);
      withinLimits = false;
    } else if (limits.warningMemoryMB && usage.memoryMB > limits.warningMemoryMB) {
      warnings.push(`Memory usage ${usage.memoryMB}MB approaching limit ${limits.maxMemoryMB}MB`);
    }

    // Check execution time limits
    if (executionTime > limits.maxExecutionTimeMs) {
      errors.push(`Execution time ${Math.round(executionTime/1000)}s exceeds limit ${Math.round(limits.maxExecutionTimeMs/1000)}s`);
      withinLimits = false;
    } else if (limits.warningExecutionTimeMs && executionTime > limits.warningExecutionTimeMs) {
      warnings.push(`Execution time ${Math.round(executionTime/1000)}s approaching limit ${Math.round(limits.maxExecutionTimeMs/1000)}s`);
    }

    return {
      usage,
      withinLimits,
      warnings,
      errors,
    };
  }

  /**
   * Forces garbage collection if available and logs memory usage
   * @param jobId - Job identifier for logging
   */
  public forceGarbageCollection(jobId: string): void {
    const beforeMemory = process.memoryUsage();
    
    if (global.gc) {
      global.gc();
      const afterMemory = process.memoryUsage();
      
      const freedMB = Math.round((beforeMemory.heapUsed - afterMemory.heapUsed) / 1024 / 1024);
      logger.info(`[ResourceMonitor] Forced GC for job ${jobId}: freed ${freedMB}MB`, {
        before: Math.round(beforeMemory.heapUsed / 1024 / 1024),
        after: Math.round(afterMemory.heapUsed / 1024 / 1024),
      });
    } else {
      logger.warn(`[ResourceMonitor] Garbage collection not available for job ${jobId}`);
    }
  }

  /**
   * Gets current CPU usage percentage (simplified)
   * @returns CPU usage percentage (approximate)
   */
  private getCpuUsage(): number {
    const startUsage = process.cpuUsage();
    const _now = Date.now();
    
    // This is a simplified CPU measurement
    // For production, consider using a more sophisticated approach
    return Math.min(100, Math.round((startUsage.user + startUsage.system) / 1000 / 10));
  }

  /**
   * Gets a summary of all active monitoring sessions
   * @returns Array of active monitoring sessions with current usage
   */
  public getActiveMonitoringSessions(): Array<{
    jobId: string;
    duration: number;
    currentUsage: ResourceUsage;
    limits: ResourceLimits;
  }> {
    const sessions = [];
    
    for (const [jobId, monitor] of this.activeMonitors) {
      const result = this.checkResources(jobId, monitor.startTime, monitor.limits);
      sessions.push({
        jobId,
        duration: Date.now() - monitor.startTime,
        currentUsage: result.usage,
        limits: monitor.limits,
      });
    }
    
    return sessions;
  }

  /**
   * Creates a resource monitor wrapper for async functions
   * @param jobId - Job identifier
   * @param fn - Async function to monitor
   * @param limits - Resource limits
   * @returns Promise that resolves with function result or rejects if limits exceeded
   */
  public async monitorAsyncFunction<T>(
    jobId: string,
    fn: () => Promise<T>,
    limits: Partial<ResourceLimits> = {}
  ): Promise<T> {
    let limitExceeded = false;
    
    this.startMonitoring(jobId, limits, (result) => {
      if (result.errors.length > 0) {
        limitExceeded = true;
      }
    });

    try {
      // Check limits before starting
      const initialCheck = this.checkResources(jobId, Date.now(), { ...ResourceMonitoringService.DEFAULT_LIMITS, ...limits });
      if (!initialCheck.withinLimits) {
        throw new Error(`Resource limits already exceeded before starting: ${initialCheck.errors.join(', ')}`);
      }

      const result = await fn();
      
      if (limitExceeded) {
        throw new Error('Resource limits were exceeded during execution');
      }
      
      return result;
    } finally {
      this.stopMonitoring(jobId);
    }
  }

  /**
   * Health check for resource monitoring service
   */
  public healthCheck(): { status: string; activeMonitors: number; details?: any } {
    try {
      const memoryUsage = process.memoryUsage();
      return {
        status: "healthy",
        activeMonitors: this.activeMonitors.size,
        details: {
          memoryUsageMB: Math.round(memoryUsage.rss / 1024 / 1024),
          heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        activeMonitors: 0,
        details: {
          error: error instanceof Error ? error.message : error,
        },
      };
    }
  }

  /**
   * Cleanup all active monitors (for graceful shutdown)
   */
  public cleanup(): void {
    logger.info(`[ResourceMonitor] Cleaning up ${this.activeMonitors.size} active monitors`);
    
    for (const [_jobId, monitor] of this.activeMonitors) {
      clearInterval(monitor.intervalId);
    }
    
    this.activeMonitors.clear();
  }
}

// Export singleton instance
export const resourceMonitoringService = new ResourceMonitoringService();

// Cleanup on process exit
process.on('SIGTERM', () => resourceMonitoringService.cleanup());
process.on('SIGINT', () => resourceMonitoringService.cleanup());