/**
 * @file secretRotationMonitor.ts
 * @description 10x Engineer: Proactive secret rotation monitoring service
 * 
 * Monitors AWS Secrets Manager for rotation events and proactively refreshes
 * database connections before authentication failures occur.
 */

import { SecretsProviderFactory } from './secretsProvider';
import { dbCache } from '../config/dbCache';
import logger from '../utils/logger';

interface RotationMetrics {
  rotationsDetected: number;
  lastRotationTime: Date | null;
  successfulRecoveries: number;
  failedRecoveries: number;
  avgRecoveryTimeMs: number;
}

export class SecretRotationMonitor {
  private static instance: SecretRotationMonitor;
  private monitorInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private metrics: RotationMetrics = {
    rotationsDetected: 0,
    lastRotationTime: null,
    successfulRecoveries: 0,
    failedRecoveries: 0,
    avgRecoveryTimeMs: 0,
  };
  private lastKnownSecretVersion: string | null = null;

  private constructor() {}

  static getInstance(): SecretRotationMonitor {
    if (!SecretRotationMonitor.instance) {
      SecretRotationMonitor.instance = new SecretRotationMonitor();
    }
    return SecretRotationMonitor.instance;
  }

  /**
   * Start proactive monitoring for secret rotations
   */
  start(intervalMs: number = 2 * 60 * 1000): void {
    if (this.isRunning) {
      logger.warn('[SecretRotationMonitor] Already running');
      return;
    }

    this.isRunning = true;
    logger.info(`[SecretRotationMonitor] Starting proactive monitoring every ${intervalMs}ms`);

    // Initial check
    this.performRotationCheck();

    this.monitorInterval = setInterval(async () => {
      try {
        await this.performRotationCheck();
      } catch (error) {
        logger.error('[SecretRotationMonitor] Monitoring check failed', { error });
      }
    }, intervalMs);
  }

  /**
   * Stop the monitoring service
   */
  stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isRunning = false;
    logger.info('[SecretRotationMonitor] Stopped');
  }

  /**
   * Proactive rotation detection and handling
   */
  private async performRotationCheck(): Promise<void> {
    const startTime = Date.now();

    try {
      // Get current secret metadata
      const secretsProvider = await SecretsProviderFactory.createFromEnvironment();
      const env = (await import('../config/env')).default;
      const secretResult = await secretsProvider.getSecret(env.DATABASE_SECRET_NAME);

      // Check if secret version has changed (indicates rotation)
      if (this.lastKnownSecretVersion && 
          secretResult.metadata.version && 
          secretResult.metadata.version !== this.lastKnownSecretVersion) {
        
        logger.warn('[SecretRotationMonitor] Secret rotation detected!', {
          oldVersion: this.lastKnownSecretVersion,
          newVersion: secretResult.metadata.version,
          provider: secretResult.metadata.provider,
        });

        await this.handleRotationEvent(secretResult.metadata.version);
      }

      // Update tracking
      this.lastKnownSecretVersion = secretResult.metadata.version || null;

      // Test database connectivity as secondary check
      await this.testDatabaseHealth();

    } catch (error) {
      logger.error('[SecretRotationMonitor] Rotation check failed', { 
        error,
        durationMs: Date.now() - startTime 
      });

      // If this is an auth error, trigger recovery
      if (dbCache.isAuthenticationError(error)) {
        logger.warn('[SecretRotationMonitor] Auth error detected during check, triggering recovery');
        await this.handleRotationEvent('unknown');
      }
    }
  }

  /**
   * Handle detected rotation event
   */
  private async handleRotationEvent(newVersion: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('[SecretRotationMonitor] Handling rotation event', { newVersion });

      // 1. Clear secrets cache to force fresh fetch
      const secretsProvider = await SecretsProviderFactory.createFromEnvironment();
      secretsProvider.clearCache();

      // 2. Refresh all database connections
      await dbCache.refreshAllClients();

      // 3. Verify connectivity with new credentials
      await this.testDatabaseHealth();

      const duration = Date.now() - startTime;
      this.metrics.rotationsDetected++;
      this.metrics.successfulRecoveries++;
      this.metrics.lastRotationTime = new Date();
      this.metrics.avgRecoveryTimeMs = 
        (this.metrics.avgRecoveryTimeMs + duration) / 2;

      logger.info('[SecretRotationMonitor] Rotation handled successfully', {
        newVersion,
        durationMs: duration,
        totalRotations: this.metrics.rotationsDetected,
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.failedRecoveries++;
      
      logger.error('[SecretRotationMonitor] Rotation handling failed', {
        newVersion,
        error,
        durationMs: duration,
      });
      
      throw error;
    }
  }

  /**
   * Test database connectivity
   */
  private async testDatabaseHealth(): Promise<void> {
    const testClient = await dbCache.getPrimaryClient();
    await testClient.$queryRaw`SELECT 1 as rotation_health_check`;
    logger.debug('[SecretRotationMonitor] Database health check passed');
  }

  /**
   * Get monitoring metrics
   */
  getMetrics(): RotationMetrics {
    return { ...this.metrics };
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastKnownSecretVersion: this.lastKnownSecretVersion,
      metrics: this.getMetrics(),
    };
  }

  /**
   * Force a rotation check (for testing/manual triggers)
   */
  async forceRotationCheck(): Promise<void> {
    logger.info('[SecretRotationMonitor] Manual rotation check triggered');
    await this.performRotationCheck();
  }
}

/**
 * Initialize the secret rotation monitor
 */
export function initializeSecretRotationMonitor(): void {
  const monitor = SecretRotationMonitor.getInstance();
  
  // Start monitoring every 2 minutes (frequent enough to catch rotations quickly)
  monitor.start(2 * 60 * 1000);
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('[SecretRotationMonitor] Received SIGTERM, stopping monitor');
    monitor.stop();
  });

  process.on('SIGINT', () => {
    logger.info('[SecretRotationMonitor] Received SIGINT, stopping monitor');
    monitor.stop();
  });

  logger.info('[SecretRotationMonitor] Initialized and started');
}

export default SecretRotationMonitor;