import Redis from 'ioredis';
import env from './env';
import logger from '../utils/logger';

const createRedisClient = () => {
  const redisConfig: any = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  };

  // Add password if provided
  if (env.REDIS_PASSWORD) {
    redisConfig.password = env.REDIS_PASSWORD;
  }

  // Add TLS configuration if enabled
  if (env.REDIS_USE_TLS) {
    redisConfig.tls = {
      // Redis Cloud specific TLS configuration
      servername: env.REDIS_HOST,
      rejectUnauthorized: false, // Redis Cloud uses self-signed certificates
    };
  }

  return new Redis(redisConfig);
};

const redis = createRedisClient();

redis.on('connect', () => {
  logger.info(`[Redis] Connected to ${env.REDIS_HOST}:${env.REDIS_PORT}`);
});

redis.on('error', (err) => {
  logger.error('[Redis] Client error:', err.message);
});

redis.on('reconnecting', () => {
  logger.info('[Redis] Reconnecting...');
});

export default redis; 