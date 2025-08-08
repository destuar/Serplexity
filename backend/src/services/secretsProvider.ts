/**
 * @file secretsProvider.ts
 * @description Cloud-agnostic secrets management abstraction
 *
 * This abstraction enables easy switching between cloud providers:
 * - AWS Secrets Manager
 * - Azure Key Vault
 * - GCP Secret Manager
 * - HashiCorp Vault
 * - Environment Variables
 * - Local development secrets
 */

import type {
  SecretsManagerClient,
  SecretsManagerClientConfig,
} from "@aws-sdk/client-secrets-manager";
import logger from "../utils/logger";

export interface DatabaseSecret {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface SecretMetadata {
  provider: string;
  secretName: string;
  version?: string;
  lastUpdated?: Date;
}

export interface SecretResult {
  secret: DatabaseSecret;
  metadata: SecretMetadata;
}

/**
 * Abstract base class for secrets providers
 * Enables consistent interface across all cloud providers
 */
export abstract class SecretsProvider {
  protected readonly providerName: string;
  protected cache = new Map<string, { result: SecretResult; expiry: number }>();
  protected readonly cacheTtl: number;

  constructor(providerName: string, cacheTtlMs: number = 5 * 60 * 1000) {
    this.providerName = providerName;
    this.cacheTtl = cacheTtlMs;
  }

  /**
   * Get secret with caching
   */
  async getSecret(secretName: string): Promise<SecretResult> {
    // Check cache first
    const cached = this.cache.get(secretName);
    if (cached && Date.now() < cached.expiry) {
      logger.info(
        `[SecretsProvider:${this.providerName}] Cache hit for secret: ${secretName}`
      );
      return cached.result;
    }

    // Fetch from provider
    const result = await this.fetchSecret(secretName);

    // Cache the result
    this.cache.set(secretName, {
      result,
      expiry: Date.now() + this.cacheTtl,
    });

    logger.info(
      `[SecretsProvider:${this.providerName}] Secret retrieved: ${secretName}`,
      {
        provider: this.providerName,
        host: result.secret.host,
      }
    );

    return result;
  }

  /**
   * Clear cache for a specific secret or all secrets
   */
  clearCache(secretName?: string): void {
    if (secretName) {
      this.cache.delete(secretName);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get the provider name
   */
  getProviderName(): string {
    return this.providerName;
  }

  /**
   * Test connection to the secrets provider
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * Fetch secret from the provider (implementation-specific)
   */
  protected abstract fetchSecret(secretName: string): Promise<SecretResult>;
}

/**
 * AWS Secrets Manager Provider
 */
export class AwsSecretsProvider extends SecretsProvider {
  private client: SecretsManagerClient | null = null; // Lazy-loaded AWS client

  constructor() {
    super("AWS_SECRETS_MANAGER");
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.initializeClient();
      if (!this.client) {
        throw new Error("Failed to initialize AWS SecretsManager client");
      }
      // Try to list secrets to test connection
      const {
        SecretsManagerClient: _SecretsManagerClient,
        ListSecretsCommand,
      } = await import("@aws-sdk/client-secrets-manager");
      await this.client.send(new ListSecretsCommand({ MaxResults: 1 }));
      return true;
    } catch (error) {
      logger.error("[AWS SecretsProvider] Connection test failed", { error });
      return false;
    }
  }

  protected async fetchSecret(_secretName: string): Promise<SecretResult> {
    await this.initializeClient();
    if (!this.client) {
      throw new Error("Failed to initialize AWS SecretsManager client");
    }

    const { GetSecretValueCommand } = await import(
      "@aws-sdk/client-secrets-manager"
    );

    const response = await this.client.send(
      new GetSecretValueCommand({
        SecretId: _secretName,
        VersionStage: "AWSCURRENT",
      })
    );

    if (!response.SecretString) {
      throw new Error(
        `[AWS SecretsProvider] Secret ${_secretName} has no value`
      );
    }

    const awsSecret = JSON.parse(response.SecretString);

    const metadata: SecretMetadata = {
      provider: this.providerName,
      secretName: _secretName,
    };

    if (response.VersionId) {
      metadata.version = response.VersionId;
    }

    if (response.CreatedDate) {
      metadata.lastUpdated = response.CreatedDate;
    }

    return {
      secret: {
        host: awsSecret.host,
        port: Number(awsSecret.port),
        username: awsSecret.username,
        password: awsSecret.password,
        database: awsSecret.dbname || awsSecret.database || "postgres",
      },
      metadata,
    };
  }

  private async initializeClient(): Promise<void> {
    if (this.client) return;

    const { SecretsManagerClient } = await import(
      "@aws-sdk/client-secrets-manager"
    );

    // Import environment configuration
    const env = (await import("../config/env")).default;

    const config: SecretsManagerClientConfig = {
      region: env.AWS_REGION,
    };

    // Use IAM role if running on AWS, otherwise use access keys
    if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
      config.credentials = {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      };
    }

    this.client = new SecretsManagerClient(config);
  }
}

/**
 * Azure Key Vault Provider (placeholder for future implementation)
 */
export class AzureKeyVaultProvider extends SecretsProvider {
  constructor() {
    super("AZURE_KEY_VAULT");
  }

  async testConnection(): Promise<boolean> {
    // TODO: Implement Azure Key Vault connection test
    throw new Error("[Azure KeyVault] Not implemented yet");
  }

  protected async fetchSecret(_secretName: string): Promise<SecretResult> {
    // TODO: Implement Azure Key Vault secret retrieval
    // const { SecretClient } = await import('@azure/keyvault-secrets');
    throw new Error("[Azure KeyVault] Not implemented yet");
  }
}

/**
 * Google Cloud Secret Manager Provider (placeholder for future implementation)
 */
export class GcpSecretManagerProvider extends SecretsProvider {
  constructor() {
    super("GCP_SECRET_MANAGER");
  }

  async testConnection(): Promise<boolean> {
    // TODO: Implement GCP Secret Manager connection test
    throw new Error("[GCP SecretManager] Not implemented yet");
  }

  protected async fetchSecret(_secretName: string): Promise<SecretResult> {
    // TODO: Implement GCP Secret Manager secret retrieval
    // const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');
    throw new Error("[GCP SecretManager] Not implemented yet");
  }
}

/**
 * Environment Variables Provider (for local development and simple deployments)
 */
export class EnvironmentSecretsProvider extends SecretsProvider {
  constructor() {
    super("ENVIRONMENT_VARIABLES");
  }

  async testConnection(): Promise<boolean> {
    // Environment variables are always "available"
    return true;
  }

  protected async fetchSecret(_secretName: string): Promise<SecretResult> {
    // Import environment configuration
    const env = (await import("../config/env")).default;

    let connectionUrl: string;

    if (_secretName === "database-primary") {
      if (!env.DATABASE_URL) {
        throw new Error("[Environment SecretsProvider] DATABASE_URL not set");
      }
      connectionUrl = env.DATABASE_URL;
    } else if (_secretName === "database-replica") {
      if (!env.READ_REPLICA_URL) {
        throw new Error(
          "[Environment SecretsProvider] READ_REPLICA_URL not set"
        );
      }
      connectionUrl = env.READ_REPLICA_URL;
    } else {
      throw new Error(
        `[Environment SecretsProvider] Unknown secret: ${_secretName}`
      );
    }

    const secret = this.parseConnectionUrl(connectionUrl);

    return {
      secret,
      metadata: {
        provider: this.providerName,
        secretName: _secretName,
        lastUpdated: new Date(),
      },
    };
  }

  private parseConnectionUrl(url: string): DatabaseSecret {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 5432,
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.slice(1) || "postgres",
    };
  }
}

/**
 * Provider types for configuration
 */
export type SecretsProviderType =
  | "aws"
  | "azure"
  | "gcp"
  | "environment"
  | "vault"; // HashiCorp Vault (future)

/**
 * Factory for creating secrets providers
 */
export class SecretsProviderFactory {
  static createProvider(type: SecretsProviderType): SecretsProvider {
    switch (type) {
      case "aws":
        return new AwsSecretsProvider();
      case "azure":
        return new AzureKeyVaultProvider();
      case "gcp":
        return new GcpSecretManagerProvider();
      case "environment":
        return new EnvironmentSecretsProvider();
      default:
        throw new Error(
          `[SecretsProviderFactory] Unsupported provider type: ${type}`
        );
    }
  }

  /**
   * Auto-detect provider based on environment configuration
   */
  static async createFromEnvironment(): Promise<SecretsProvider> {
    const env = (await import("../config/env")).default;

    if (env.USE_AWS_SECRETS) {
      return this.createProvider("aws");
    } else {
      return this.createProvider("environment");
    }
  }
}
