import { Queue } from 'bullmq';
import env from '../config/env';

// Enhanced logging for queue setup
const queueLog = (message: string, level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' = 'INFO', metadata?: Record<string, any>) => {
  const timestamp = new Date().toISOString();
  let logLine = `[${timestamp}][ReportGenerationQueue][${level}] ${message}`;
  
  if (metadata && Object.keys(metadata).length > 0) {
    logLine += ` | Meta: ${JSON.stringify(metadata)}`;
  }
  
  console.log(logLine);
};

// Skip queue initialization in test environment to prevent Jest hanging
let reportGenerationQueue: Queue | null = null;

queueLog('Initializing report generation queue', 'INFO', {
  redisHost: env.REDIS_HOST,
  redisPort: env.REDIS_PORT,
  queueName: 'report-generation'
});

reportGenerationQueue = new Queue('report-generation', {
  connection: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  },
});

export { reportGenerationQueue };

// Log queue events for monitoring (only if queue exists)
if (reportGenerationQueue) {
  reportGenerationQueue.on('error', (error: Error) => {
    queueLog('Queue error occurred', 'ERROR', {
      errorMessage: error.message,
      errorType: error.name,
      stack: error.stack
    });
  });

  reportGenerationQueue.on('waiting', (job: any) => {
    queueLog('Job added to queue and waiting', 'INFO', {
      jobId: job.id,
      jobName: job.name,
      runId: job.data?.runId,
      companyId: job.data?.company?.id,
      timestamp: new Date().toISOString()
    });
  });

  queueLog('Report generation queue initialized successfully', 'INFO', {
    queueName: reportGenerationQueue.name,
    redisConnection: `${env.REDIS_HOST}:${env.REDIS_PORT}`
  });
} 