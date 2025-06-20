import { Queue } from 'bullmq';
import env from '../config/env';

export const reportGenerationQueue = new Queue('report-generation', {
  connection: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  },
}); 