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