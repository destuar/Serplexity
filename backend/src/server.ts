import './config/tracing'; // IMPORTANT: Must be the first import to ensure all modules are instrumented
import app from './app';
import http from 'http';
import env from './config/env';
import prisma from './config/db';
import './queues/reportWorker'; // This initializes and starts the worker process
import './queues/archiveWorker'; // This initializes and starts the archive worker process
import './queues/masterSchedulerWorker'; // This initializes the daily report scheduler worker
import { scheduleDailyReportTrigger } from './queues/masterScheduler';

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

  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('🚀 Automated daily reporting system is active!');
  });
};

startServer(); 