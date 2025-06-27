import Redis from 'ioredis';
import env from './env';

let redis: Redis | null = null;

redis = new Redis({ host: env.REDIS_HOST, port: env.REDIS_PORT });

redis.on('error', (err) => console.error('[Redis] Client error', err));

export default redis; 