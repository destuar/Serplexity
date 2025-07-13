import env from './env';
import { getBullMQConnection } from './redisPool';

// Default BullMQ options using pooled connections
export const getBullMQOptions = () => ({
  connection: getBullMQConnection(),
  prefix: env.BULLMQ_QUEUE_PREFIX,
});

// Export the connection function for compatibility
export { getBullMQConnection };