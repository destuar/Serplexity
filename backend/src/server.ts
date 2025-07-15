import './config/tracing'; // IMPORTANT: Must be the first import to ensure all modules are instrumented
import app from './app';
import http from 'http';
import env from './config/env';
import prisma from './config/db';
import './queues/reportWorker'; // This initializes and starts the worker process
import './queues/archiveWorker'; // This initializes and starts the archive worker process
import './queues/masterSchedulerWorker'; // This initializes the daily report scheduler worker
import './queues/backupSchedulerWorker'; // This initializes the backup scheduler worker
import { scheduleDailyReportTrigger } from './queues/masterScheduler';
import { scheduleBackupDailyReportTrigger } from './queues/backupScheduler';

const PORT = env.PORT;

const server = http.createServer(app);

const startServer = async () => {
  // Connect to database
  try {
    await prisma.$connect();
    console.log('Database connection successful.');
  } catch (error) {
    console.error('Error connecting to the database:', error);
    process.exit(1);
  }

  // Initialize daily report scheduler
  await scheduleDailyReportTrigger();
  console.log('Daily report scheduler initialized.');

  // Initialize backup scheduler
  await scheduleBackupDailyReportTrigger();
  console.log('Backup report scheduler initialized.');

  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('🚀 Automated daily reporting system is active!');
  });
};

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`\n[${signal}] Received shutdown signal, starting graceful shutdown...`);
  
  try {
    // Stop accepting new connections
    if (server) {
      server.close(() => {
        console.log('HTTP server closed');
      });
    }
    
    // Give existing connections time to finish
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

startServer(); 