/**
 * Worker Runner
 * Starts all queue workers in a single, non–hot-reload process to prevent job stalls
 */

import env from "../config/env";

// Ensure tracing and global config loads first if needed
import "../config/tracing";

// Start workers
import "../queues/backupSchedulerWorker";
import "../queues/billingPeriodScheduler";
import "../queues/emailNotificationWorker";
import "../queues/masterSchedulerWorker";
import "../queues/reportWorker";
import "../queues/webAuditWorker";
import "../queues/websiteAnalyticsWorker";

// Keep process alive
const keepAlive = () => setInterval(() => {}, 1 << 30);
keepAlive();

// Minimal logging
// eslint-disable-next-line no-console
console.log(`Workers running with BULLMQ prefix: ${env.BULLMQ_QUEUE_PREFIX}`);
