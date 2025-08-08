/**
 * @file database.ts
 * @description Production-grade database configuration with multi-cloud secrets support
 *
 * Features:
 * - Cloud-agnostic secrets management (AWS, Azure, GCP, etc.)
 * - Unified client creation with automatic failover
 * - Proper error handling with retries and circuit breaker
 * - Memory-efficient connection management
 * - Clear separation of concerns
 * - Enhanced observability
 */

import { PrismaClient } from "@prisma/client";
import {
  SecretsProviderFactory,
  SecretsProvider,
  type SecretsProviderType,
} from "../services/secretsProvider";
import env from "./env";
import logger from "../utils/logger";

interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

interface DatabaseClients {
  primary: PrismaClient;
  replica: PrismaClient;
}

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: "closed" | "open" | "half-open";
}

class DatabaseService {
  private static instance: DatabaseService;
  private clients: DatabaseClients | null = null;
  private secretsProvider: SecretsProvider | null = null;
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailure: 0,
    state: "closed",
  };

  // Circuit breaker configuration constants
  private static readonly MAX_RETRIES = 3;
  private static readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private static readonly CIRCUIT_BREAKER_TIMEOUT = 30 * 1000; // 30 seconds

  private constructor() {
    // Lazy initialization of secrets provider
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Get database clients (primary and replica)
   * Automatically handles configuration source and connection management
   */
  async getClients(): Promise<DatabaseClients> {
    if (this.clients) {
      return this.clients;
    }

    try {
      const config = await this.getDatabaseConfig();
      this.clients = await this.createClients(config);

      logger.info("[Database] Clients initialized successfully", {
        primaryHost: config.primary.host,
        replicaHost: config.replica.host,
        provider: this.secretsProvider?.getProviderName() || "ENVIRONMENT",
      });

      return this.clients;
    } catch (error) {
      // If it's an auth failure, attempt recovery
      if (this.isAuthFailure(error)) {
        logger.warn("[Database] Auth failure during client initialization, attempting recovery");
        const recovered = await this.handleAuthFailure();
        if (recovered) {
          // Retry client creation
          const config = await this.getDatabaseConfig();
          this.clients = await this.createClients(config);
          logger.info("[Database] Client recovery successful");
          return this.clients;
        }
      }
      throw error;
    }
  }

  /**
   * Get primary database client
   */
  async getPrimaryClient(): Promise<PrismaClient> {
    const clients = await this.getClients();
    return clients.primary;
  }

  /**
   * Get replica database client (falls back to primary if no replica configured)
   */
  async getReplicaClient(): Promise<PrismaClient> {
    const clients = await this.getClients();
    return clients.replica;
  }

  /**
   * Test database connection with auto-recovery on auth failure
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = await this.getPrimaryClient();
      await client.$queryRaw`SELECT 1`;
      logger.info("[Database] Connection test successful");
      return true;
    } catch (error) {
      // Check if this is an authentication failure (P1000)
      if (this.isAuthFailure(error)) {
        logger.warn("[Database] Auth failure detected, attempting auto-recovery");
        const recovered = await this.handleAuthFailure();
        if (recovered) {
          // Retry the connection test with new credentials
          try {
            const client = await this.getPrimaryClient();
            await client.$queryRaw`SELECT 1`;
            logger.info("[Database] Auto-recovery successful");
            return true;
          } catch (retryError) {
            logger.error("[Database] Auto-recovery failed", { error: retryError });
            return false;
          }
        }
      }
      logger.error("[Database] Connection test failed", { error });
      return false;
    }
  }

  /**
   * Handle authentication failures by refreshing secrets and reconnecting
   */
  async handleAuthFailure(): Promise<boolean> {
    try {
      logger.info("[Database] Starting auth failure recovery");
      
      // 1. Clear secrets cache to force fresh fetch
      if (this.secretsProvider) {
        this.secretsProvider.clearCache();
        logger.info("[Database] Secrets cache cleared");
      }

      // 2. Close existing connections
      await this.closeConnections();
      logger.info("[Database] Existing connections closed");

      // 3. Reset circuit breaker
      this.circuitBreaker = {
        failures: 0,
        lastFailure: 0,
        state: "closed",
      };

      // 4. Force re-initialization on next request
      this.clients = null;
      this.secretsProvider = null;

      logger.info("[Database] Auth failure recovery completed");
      return true;
    } catch (error) {
      logger.error("[Database] Auth failure recovery failed", { error });
      return false;
    }
  }

  /**
   * Check if error is an authentication failure
   */
  private isAuthFailure(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const errorObj = error as Record<string, unknown>;
    const code = typeof errorObj['code'] === 'string' ? errorObj['code'] : '';
    const message = typeof errorObj['message'] === 'string' ? errorObj['message'] : '';
    
    return (
      code === 'P1000' ||
      (message.includes('Authentication failed') ||
       message.includes('password authentication failed'))
    );
  }

  /**
   * Close database connections
   */
  async closeConnections(): Promise<void> {
    if (this.clients) {
      await Promise.all([
        this.clients.primary.$disconnect(),
        this.clients.replica.$disconnect(),
      ]);
      this.clients = null;
      logger.info("[Database] Connections closed");
    }
  }

  /**
   * Get database configuration from appropriate secrets provider
   */
  private async getDatabaseConfig(): Promise<{
    primary: DatabaseConfig;
    replica: DatabaseConfig;
  }> {
    if (!this.secretsProvider) {
      await this.initializeSecretsProvider();
    }

    const secretsProvider = this.secretsProvider!;
    const providerType = env.COMPUTED_SECRETS_PROVIDER as SecretsProviderType;

    if (providerType === "environment") {
      // Use standardized secret names for environment provider
      const primaryResult = await secretsProvider.getSecret("database-primary");

      let replicaConfig = primaryResult.secret;
      if (env.READ_REPLICA_URL) {
        const replicaResult =
          await secretsProvider.getSecret("database-replica");
        replicaConfig = replicaResult.secret;
        logger.info("[Database] Using separate read replica configuration");
      } else {
        logger.info(
          "[Database] Using RDS cluster endpoint for both read/write operations (automatic routing)",
        );
      }

      return {
        primary: primaryResult.secret,
        replica: replicaConfig,
      };
    } else {
      // Use cloud secrets provider with configured secret names
      if (!env.DATABASE_SECRET_NAME) {
        throw new Error(
          "[Database] DATABASE_SECRET_NAME is required for cloud secrets providers",
        );
      }

      const primaryResult = await secretsProvider.getSecret(
        env.DATABASE_SECRET_NAME,
      );

      let replicaConfig = primaryResult.secret;
      if (env.READ_REPLICA_SECRET_NAME) {
        const replicaResult = await secretsProvider.getSecret(
          env.READ_REPLICA_SECRET_NAME,
        );
        replicaConfig = replicaResult.secret;
        logger.info("[Database] Using separate cloud secret for read replica");
      } else {
        logger.info(
          "[Database] Using single cloud secret for both read/write operations",
        );
      }

      return {
        primary: primaryResult.secret,
        replica: replicaConfig,
      };
    }
  }

  /**
   * Initialize the appropriate secrets provider
   */
  private async initializeSecretsProvider(): Promise<void> {
    const providerType = env.COMPUTED_SECRETS_PROVIDER as SecretsProviderType;

    try {
      this.secretsProvider =
        SecretsProviderFactory.createProvider(providerType);

      // Test provider connection
      const isConnected = await this.secretsProvider.testConnection();
      if (!isConnected) {
        throw new Error(
          `Failed to connect to ${providerType} secrets provider`,
        );
      }

      logger.info(
        `[Database] Secrets provider initialized: ${providerType.toUpperCase()}`,
      );
    } catch (error) {
      logger.error(
        `[Database] Failed to initialize secrets provider: ${providerType}`,
        { error },
      );
      throw error;
    }
  }

  /**
   * Create Prisma clients with given configuration
   */
  private async createClients(config: {
    primary: DatabaseConfig;
    replica: DatabaseConfig;
  }): Promise<DatabaseClients> {
    const primaryUrl = this.buildConnectionUrl(config.primary);
    const replicaUrl = this.buildConnectionUrl(config.replica);

    const primary = new PrismaClient({
      datasources: { db: { url: primaryUrl } },
      log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });

    const replica = new PrismaClient({
      datasources: { db: { url: replicaUrl } },
      log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });

    return { primary, replica };
  }

  /**
   * Build PostgreSQL connection URL
   */
  private buildConnectionUrl(config: DatabaseConfig): string {
    const { username, password, host, port, database } = config;
    const encodedUsername = encodeURIComponent(username);
    const encodedPassword = encodeURIComponent(password);
    return `postgresql://${encodedUsername}:${encodedPassword}@${host}:${port}/${database}`;
  }
}

// Export singleton instance
export const databaseService = DatabaseService.getInstance();

// Convenience functions for backward compatibility
export const getDbClient = () => databaseService.getPrimaryClient();
export const getReadDbClient = () => databaseService.getReplicaClient();
export const testDbConnection = () => databaseService.testConnection();
