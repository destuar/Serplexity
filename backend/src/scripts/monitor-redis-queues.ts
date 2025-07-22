import { redis } from "../config/redis";
import { Queue } from "bullmq";
import logger from "../utils/logger";
import env from "../config/env";

async function monitorQueues() {
  try {
    logger.info("🔍 Monitoring Redis Queues...\n");

    // Get all keys related to BullMQ using the configured prefix
    const prefix = env.BULLMQ_QUEUE_PREFIX || "serplexity-queue";
    const queueKeys = await redis.keys(`${prefix}:*`);
    
    // Also check for legacy bull: keys for comparison
    const legacyKeys = await redis.keys("bull:*");

    logger.info(`Using queue prefix: ${prefix}`);
    
    if (queueKeys.length === 0 && legacyKeys.length === 0) {
      logger.info("No BullMQ queues found in Redis");
      return;
    }

    // Process current queues with configured prefix
    if (queueKeys.length > 0) {
      logger.info("\n📊 Current Queues (with configured prefix):");
      const queueStats: Record<string, any> = {};

      for (const key of queueKeys) {
        const parts = key.split(":");
        if (parts.length >= 3) {
          const queueName = parts[1];
          const type = parts[2];

          if (!queueStats[queueName]) {
            queueStats[queueName] = {};
          }

          if (
            type === "waiting" ||
            type === "active" ||
            type === "completed" ||
            type === "failed"
          ) {
            const count = await redis.llen(key);
            queueStats[queueName][type] = count;
          }
        }
      }

      // Display queue statistics
      for (const [queueName, stats] of Object.entries(queueStats)) {
        logger.info(`📋 Queue: ${prefix}:${queueName}`);
        logger.info(`   Waiting: ${stats.waiting || 0}`);
        logger.info(`   Active: ${stats.active || 0}`);
        logger.info(`   Completed: ${stats.completed || 0}`);
        logger.info(`   Failed: ${stats.failed || 0}`);
        logger.info("");
      }
    }

    // Show legacy queues if they exist
    if (legacyKeys.length > 0) {
      logger.info("⚠️  Legacy Queues Found (bull: prefix):");
      const legacyStats: Record<string, any> = {};

      for (const key of legacyKeys) {
        const parts = key.split(":");
        if (parts.length >= 3) {
          const queueName = parts[1];
          const type = parts[2];

          if (!legacyStats[queueName]) {
            legacyStats[queueName] = {};
          }

          if (
            type === "waiting" ||
            type === "active" ||
            type === "completed" ||
            type === "failed"
          ) {
            const count = await redis.llen(key);
            legacyStats[queueName][type] = count;
          }
        }
      }

      for (const [queueName, stats] of Object.entries(legacyStats)) {
        logger.info(`📋 Legacy Queue: bull:${queueName}`);
        logger.info(`   Waiting: ${stats.waiting || 0}`);
        logger.info(`   Active: ${stats.active || 0}`);
        logger.info(`   Completed: ${stats.completed || 0}`);
        logger.info(`   Failed: ${stats.failed || 0}`);
        logger.info("");
      }
      
      logger.info("Note: Legacy queues should be cleaned up if no longer needed.");
    }

    // Get Redis memory usage
    const info = await redis.info("memory");
    const memoryMatch = info.match(/used_memory_human:(\S+)/);
    if (memoryMatch) {
      logger.info(`💾 Redis Memory Usage: ${memoryMatch[1]}`);
    }

    // Get total keys
    const dbInfo = await redis.info("keyspace");
    logger.info(`🔑 Redis Keys: ${dbInfo || "No keyspace info"}`);
  } catch (error) {
    logger.error("❌ Error monitoring queues:", error);
  } finally {
    await redis.quit();
  }
}

monitorQueues();
