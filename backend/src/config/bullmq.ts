import env from './env';
import { bullmqConnection } from './redis';
import { QueueOptions, WorkerOptions, JobsOptions } from 'bullmq';

// Production-optimized BullMQ configuration
const QUEUE_OPTIONS: QueueOptions = {
  connection: bullmqConnection,
  prefix: env.BULLMQ_QUEUE_PREFIX,
  
  // Default job options for reliability
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50,      // Keep last 50 failed jobs
    attempts: 3,           // Retry failed jobs 3 times
    backoff: {
      type: 'exponential',
      delay: 2000,         // Start with 2 second delay
    },
    delay: 0,              // No initial delay
    priority: 0,           // Default priority
    lifo: false,           // FIFO processing
  },
};

const WORKER_OPTIONS: WorkerOptions = {
  connection: bullmqConnection,
  
  // Concurrency and performance
  concurrency: 2,        // Process 2 jobs simultaneously
  maxStalledCount: 1,    // Max times a job can be stalled
  stalledInterval: 30000, // Check for stalled jobs every 30s
  
  // Job processing timeouts
  drainDelay: 5,         // Delay when queue is empty
  
  // Error handling
  skipVersionCheck: false,
  skipLockRenewal: false,
  
  // Metrics and monitoring
  metrics: {
    maxDataPoints: 100,  // Keep metrics for monitoring
  },
};

// Specific job options for different job types
const JOB_OPTIONS: Record<string, Partial<JobsOptions>> = {
  'report-generation': {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,         // 5 second initial delay for reports
    },
    removeOnComplete: 50,  // Keep more completed report jobs
    removeOnFail: 25,      // Keep more failed report jobs for debugging
  },
  
  'email-notification': {
    attempts: 5,           // More attempts for email delivery
    backoff: {
      type: 'exponential',
      delay: 1000,         // Faster retry for emails
    },
    removeOnComplete: 20,
    removeOnFail: 10,
  },
  
  'data-processing': {
    attempts: 2,           // Fewer attempts for data processing
    backoff: {
      type: 'fixed',
      delay: 10000,        // 10 second fixed delay
    },
    removeOnComplete: 30,
    removeOnFail: 15,
  },
};

// Export the optimized options
export const getBullMQOptions = (): QueueOptions => QUEUE_OPTIONS;
export const getWorkerOptions = (): WorkerOptions => WORKER_OPTIONS;
export const getJobOptions = (jobType: string): Partial<JobsOptions> => {
  return JOB_OPTIONS[jobType] || QUEUE_OPTIONS.defaultJobOptions || {};
};

// Export the connection function for compatibility
export const getBullMQConnection = () => bullmqConnection;

// Health check for BullMQ
export const checkBullMQHealth = async () => {
  try {
    // Test basic connection
    await bullmqConnection.ping();
    
    return {
      status: 'healthy',
      connection: 'active',
      prefix: env.BULLMQ_QUEUE_PREFIX,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      connection: 'failed',
    };
  }
};