import { redis } from '../config/redis';
import logger from '../utils/logger';

async function testRedisConnection() {
  try {
    logger.info('Testing Redis connection...');
    
    // First, ensure we're connected
    await redis.connect();
    logger.info('✅ Redis connection established');
    
    // Test basic connection
    const pingResult = await redis.ping();
    logger.info(`✅ Redis ping successful: ${pingResult}`);
    
    // Test set/get
    await redis.set('test:connection', 'hello-world', 'EX', 60);
    const value = await redis.get('test:connection');
    logger.info(`✅ Redis set/get test: ${value}`);
    
    // Test delete
    const deleteResult = await redis.del('test:connection');
    logger.info(`✅ Redis delete test successful: ${deleteResult} key(s) deleted`);
    
    // Get Redis info
    const info = await redis.info('server');
    const version = info.match(/redis_version:(\S+)/)?.[1];
    logger.info(`✅ Redis server version: ${version}`);
    
    // Test connection status
    logger.info(`✅ Redis connection status: ${redis.status}`);
    
    logger.info('🎉 All Redis tests passed!');
    
  } catch (error) {
    logger.error('❌ Redis connection test failed:', error);
    if (error instanceof Error) {
      logger.error('Error message:', error.message);
      logger.error('Error stack:', error.stack);
    }
    process.exit(1);
  } finally {
    try {
      await redis.quit();
      logger.info('✅ Redis connection closed cleanly');
    } catch (closeError) {
      logger.error('Error closing Redis connection:', closeError);
    }
    process.exit(0);
  }
}

testRedisConnection();