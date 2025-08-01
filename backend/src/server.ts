/**
 * @file server.ts
 * @description This is the main entry point for the backend server. It initializes the database connection,
 * starts the HTTP server, and handles graceful shutdown.
 *
 * @dependencies
 * - http: Node.js module for creating HTTP servers.
 * - ./app: The Express application instance.
 * - ./config/env: Environment variable configuration.
 * - ./config/db: Singleton Prisma client instance.
 * - ./config/tracing: OpenTelemetry tracing initialization.
 * - ./queues/reportWorker: Initializes the report generation worker.
 * - ./queues/archiveWorker: Initializes the archive worker.
 * - ./queues/masterSchedulerWorker: Initializes the master scheduler worker.
 * - ./queues/backupSchedulerWorker: Initializes the backup scheduler worker.
 * - ./queues/masterScheduler: Schedules the daily report trigger.
 * - ./queues/backupScheduler: Schedules the backup daily report trigger.
 */
import "./config/tracing"; // IMPORTANT: Must be the first import to ensure all modules are instrumented
import app from "./app";
import http from "http";
import env from "./config/env";
import { dbCache } from "./config/dbCache";
import SystemValidator from "./startup/systemValidator";
import "./queues/reportWorker"; // This initializes and starts the worker process
import "./queues/archiveWorker"; // This initializes and starts the archive worker process
import "./queues/masterSchedulerWorker"; // This initializes the daily report scheduler worker
import "./queues/backupSchedulerWorker"; // This initializes the backup scheduler worker
import "./queues/reportEvents"; // Initializes the report event listener
import { scheduleDailyReportTrigger } from "./queues/masterScheduler";
import { scheduleBackupDailyReportTrigger } from "./queues/backupScheduler";
import { initializeHealthCheckScheduler } from "./queues/healthCheckScheduler";
import { redis } from "./config/redis";

const PORT = env.PORT;

const server = http.createServer(app);

const startServer = async () => {
  try {
    // Perform comprehensive startup validation
    console.log("🔍 Starting system validation...");
    const systemValidator = SystemValidator.getInstance();
    const validationResult = await systemValidator.validateSystemStartup();
    
    if (validationResult.degradedMode) {
      console.log("⚠️ System starting in DEGRADED MODE - some features will be limited");
    }

    console.log("🔗 Initializing database cache...");
    await dbCache.initialize();
    console.log("✅ Database cache initialized successfully.");

    // Initialize daily report scheduler
    await scheduleDailyReportTrigger();
    console.log("Daily report scheduler initialized.");

    // Initialize backup scheduler
    await scheduleBackupDailyReportTrigger();
    console.log("Backup report scheduler initialized.");

    // Initialize health check scheduler for auto-recovery
    await initializeHealthCheckScheduler(redis);
    console.log("✅ Health check scheduler initialized - auto-recovery active!");

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log("🚀 Automated daily reporting system is active!");
    });
  } catch (error) {
    console.error("❌ Error starting server:", error);
    process.exit(1);
  }
};

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(
    `\n[${signal}] Received shutdown signal, starting graceful shutdown...`,
  );

  try {
    // Stop accepting new connections
    if (server) {
      server.close(() => {
        console.log("HTTP server closed");
      });
    }

    // Give existing connections time to finish
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    console.error("Error during graceful shutdown:", error);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown("UNHANDLED_REJECTION");
});

startServer();
