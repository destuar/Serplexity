import env from './env';

// Shared BullMQ Redis connection configuration
export const getBullMQConnection = () => {
  const config: any = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  };

  // Add password if provided
  if (env.REDIS_PASSWORD) {
    config.password = env.REDIS_PASSWORD;
  }

  // Add TLS configuration if enabled
  if (env.REDIS_USE_TLS) {
    config.tls = {
      servername: env.REDIS_HOST,
      rejectUnauthorized: false, // Redis Cloud uses self-signed certificates
    };
  }

  return config;
};

// Default BullMQ options
export const getBullMQOptions = () => ({
  connection: getBullMQConnection(),
  prefix: env.BULLMQ_QUEUE_PREFIX,
});