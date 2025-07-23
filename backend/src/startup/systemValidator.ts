/**
 * @file systemValidator.ts
 * @description System-wide startup validation to prevent cascade failures
 * Validates all critical dependencies before the application starts accepting traffic
 */

import logger from "../utils/logger";
import env from "../config/env";
import DependencyValidator from "../services/dependencyValidator";

export interface StartupValidationResult {
  success: boolean;
  criticalFailures: string[];
  warnings: string[];
  canProceed: boolean;
  degradedMode: boolean;
}

export class SystemValidator {
  private static instance: SystemValidator;
  
  public static getInstance(): SystemValidator {
    if (!SystemValidator.instance) {
      SystemValidator.instance = new SystemValidator();
    }
    return SystemValidator.instance;
  }

  /**
   * Perform comprehensive startup validation
   */
  public async validateSystemStartup(): Promise<StartupValidationResult> {
    logger.info("🚀 [SystemValidator] Starting system-wide startup validation");
    
    const validator = DependencyValidator.getInstance();
    const validation = await validator.validateAll(env.FAIL_FAST_ON_DEPENDENCIES);
    
    const result: StartupValidationResult = {
      success: validation.success,
      criticalFailures: validation.criticalFailures,
      warnings: validation.warnings,
      canProceed: this.determineIfCanProceed(validation),
      degradedMode: !validation.success && this.canRunInDegradedMode(validation)
    };

    // Log comprehensive startup summary
    this.logStartupSummary(result);
    
    // Handle startup decision
    if (env.FAIL_FAST_ON_DEPENDENCIES && !result.success) {
      logger.error("💥 [SystemValidator] FAIL_FAST enabled - System cannot start due to critical dependency failures");
      throw new Error(`Critical dependencies failed: ${result.criticalFailures.join('; ')}`);
    }

    if (!result.canProceed) {
      logger.error("💥 [SystemValidator] System cannot start - too many critical failures");
      throw new Error(`System startup blocked: ${result.criticalFailures.join('; ')}`);
    }

    if (result.degradedMode) {
      logger.warn("⚠️ [SystemValidator] System starting in DEGRADED MODE - some features will be unavailable");
    } else {
      logger.info("✅ [SystemValidator] System startup validation passed - all systems nominal");
    }

    return result;
  }

  /**
   * Determine if system can proceed with startup
   */
  private determineIfCanProceed(validation: { success: boolean; criticalFailures: string[]; }): boolean {
    // Core infrastructure checks that must pass
    const coreInfrastructureChecks = [
      'database-connectivity',
      'redis-connectivity'
    ];

    const hasCorInfrastructureFailures = validation.criticalFailures.some(failure =>
      coreInfrastructureChecks.some(check => failure.includes(check))
    );

    // If core infrastructure fails, we cannot proceed
    if (hasCorInfrastructureFailures) {
      return false;
    }

    // Allow proceeding if only non-critical services fail (like PydanticAI)
    return true;
  }

  /**
   * Determine if system can run in degraded mode
   */
  private canRunInDegradedMode(validation: { success: boolean; criticalFailures: string[]; }): boolean {
    // We can run in degraded mode if only AI/ML services fail
    const aiServiceFailures = [
      'pydantic-ai-installation',
      'python-availability',
      'python-requirements-sync'
    ];

    const onlyAIFailures = validation.criticalFailures.every(failure =>
      aiServiceFailures.some(aiFailure => failure.includes(aiFailure))
    );

    return onlyAIFailures;
  }

  /**
   * Log comprehensive startup summary
   */
  private logStartupSummary(result: StartupValidationResult): void {
    const summary = {
      systemStatus: result.success ? "HEALTHY" : (result.degradedMode ? "DEGRADED" : "FAILED"),
      canProceed: result.canProceed,
      degradedMode: result.degradedMode,
      criticalFailures: result.criticalFailures.length,
      warnings: result.warnings.length,
      timestamp: new Date().toISOString()
    };

    if (result.success) {
      logger.info("🎉 [SystemValidator] STARTUP VALIDATION SUMMARY", summary);
    } else if (result.degradedMode) {
      logger.warn("⚠️ [SystemValidator] STARTUP VALIDATION SUMMARY - DEGRADED MODE", {
        ...summary,
        criticalFailuresDetail: result.criticalFailures,
        warningsDetail: result.warnings,
        impact: "Some AI/ML features will be unavailable"
      });
    } else {
      logger.error("💥 [SystemValidator] STARTUP VALIDATION SUMMARY - CRITICAL FAILURE", {
        ...summary,
        criticalFailuresDetail: result.criticalFailures,
        remediationRequired: true
      });
    }
  }

  /**
   * Get system health status for monitoring endpoints
   */
  public async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    dependencies: any;
    timestamp: string;
  }> {
    const validator = DependencyValidator.getInstance();
    const healthSummary = validator.getHealthSummary();
    const validationResults = validator.getValidationResults();

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (healthSummary.criticalUnhealthy > 0) {
      const validation = await validator.validateAll(false);
      if (this.canRunInDegradedMode(validation)) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }
    }

    return {
      status,
      dependencies: {
        total: healthSummary.total,
        healthy: healthSummary.healthy,
        unhealthy: healthSummary.unhealthy,
        criticalUnhealthy: healthSummary.criticalUnhealthy,
        details: Object.fromEntries(validationResults)
      },
      timestamp: new Date().toISOString()
    };
  }
}

export default SystemValidator;