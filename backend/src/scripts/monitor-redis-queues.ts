import { redis } from '../config/redis';
import { Queue } from 'bullmq';
import logger from '../utils/logger';

async function monitorQueues() {
  try {
    logger.info('🔍 Monitoring Redis Queues...\n');
    
    // Get all keys related to BullMQ
    const queueKeys = await redis.keys('bull:*');
    
    if (queueKeys.length === 0) {
      logger.info('No BullMQ queues found in Redis');
      return;
    }
    
    // Group keys by queue name
    const queueStats: Record<string, any> = {};
    
    for (const key of queueKeys) {
      const parts = key.split(':');
      if (parts.length >= 3) {
        const queueName = parts[1];
        const type = parts[2];
        
        if (!queueStats[queueName]) {
          queueStats[queueName] = {};
        }
        
        if (type === 'waiting' || type === 'active' || type === 'completed' || type === 'failed') {
          const count = await redis.llen(key);
          queueStats[queueName][type] = count;
        }
      }
    }
    
    // Display queue statistics
    for (const [queueName, stats] of Object.entries(queueStats)) {
      logger.info(`📋 Queue: ${queueName}`);
      logger.info(`   Waiting: ${stats.waiting || 0}`);
      logger.info(`   Active: ${stats.active || 0}`);
      logger.info(`   Completed: ${stats.completed || 0}`);
      logger.info(`   Failed: ${stats.failed || 0}`);
      logger.info('');
    }
    
    // Get Redis memory usage
    const info = await redis.info('memory');
    const memoryMatch = info.match(/used_memory_human:(\S+)/);
    if (memoryMatch) {
      logger.info(`💾 Redis Memory Usage: ${memoryMatch[1]}`);
    }
    
    // Get total keys
    const dbInfo = await redis.info('keyspace');
    logger.info(`🔑 Redis Keys: ${dbInfo || 'No keyspace info'}`);
    
  } catch (error) {
    logger.error('❌ Error monitoring queues:', error);
  } finally {
    await redis.quit();
  }
}

monitorQueues();