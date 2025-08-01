/**
 * @file dbCache.ts
 * @description Database client cache to prevent connection pool exhaustion
 * 
 * This singleton pattern ensures that database clients are reused across
 * all requests instead of creating new connections every time.
 */

import { PrismaClient } from "@prisma/client";
import { getDbClient, getReadDbClient } from "./database";
import logger from "../utils/logger";

class DatabaseCache {
  private static instance: DatabaseCache;
  private primaryClient: PrismaClient | null = null;
  private replicaClient: PrismaClient | null = null;
  private isInitialized = false;
  private refreshInProgress = false;

  private constructor() {}

  static getInstance(): DatabaseCache {
    if (!DatabaseCache.instance) {
      DatabaseCache.instance = new DatabaseCache();
    }
    return DatabaseCache.instance;
  }

  async getPrimaryClient(): Promise<PrismaClient> {
    if (!this.primaryClient) {
      this.primaryClient = await getDbClient();
    }
    return this.primaryClient;
  }

  async getReplicaClient(): Promise<PrismaClient> {
    if (!this.replicaClient) {
      this.replicaClient = await getReadDbClient();
    }
    return this.replicaClient;
  }

  /**
   * 10x ENGINEER: Force refresh all cached database clients
   * This is called when authentication failures are detected
   */
  async refreshAllClients(): Promise<void> {
    if (this.refreshInProgress) {
      logger.info('[DatabaseCache] Refresh already in progress, waiting...');
      // Wait for current refresh to complete
      while (this.refreshInProgress) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.refreshInProgress = true;
    logger.info('[DatabaseCache] Refreshing all database clients due to auth failure');

    try {
      // Close existing connections
      await this.close();
      
      // Clear the initialization flag to force re-initialization
      this.isInitialized = false;
      
      // Re-initialize with fresh credentials
      await this.initialize();
      
      logger.info('[DatabaseCache] All database clients refreshed successfully');
    } catch (error) {
      logger.error('[DatabaseCache] Failed to refresh database clients', { error });
      throw error;
    } finally {
      this.refreshInProgress = false;
    }
  }

  /**
   * Check if an error is a database authentication failure
   */
  isAuthenticationError(error: any): boolean {
    return (
      error?.code === 'P1000' ||
      error?.message?.includes('Authentication failed') ||
      error?.message?.includes('password authentication failed') ||
      error?.message?.includes('provided database credentials') ||
      error?.message?.includes('are not valid')
    );
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Pre-initialize both clients
    await this.getPrimaryClient();
    await this.getReplicaClient();
    
    this.isInitialized = true;
    logger.info("Database cache initialized successfully");
  }

  async close(): Promise<void> {
    const promises = [];
    
    if (this.primaryClient) {
      promises.push(this.primaryClient.$disconnect());
      this.primaryClient = null;
    }
    
    if (this.replicaClient) {
      promises.push(this.replicaClient.$disconnect());
      this.replicaClient = null;
    }

    await Promise.all(promises);
    this.isInitialized = false;
    logger.info("Database cache closed successfully");
  }
}

// Export singleton instance
export const dbCache = DatabaseCache.getInstance();

// Convenience functions for controllers
export const getPrismaClient = () => dbCache.getPrimaryClient();
export const getReadPrismaClient = () => dbCache.getReplicaClient();