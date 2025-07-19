#!/usr/bin/env ts-node

/**
 * Real-time monitoring script for the StreamingDatabaseWriter
 * Run this during report generation to detect bottlenecks and hanging issues
 */

import { PrismaClient } from "@prisma/client";
import { performance } from "perf_hooks";

const prisma = new PrismaClient();

interface MonitoringStats {
  runId: string;
  startTime: number;
  lastResponseTime?: number;
  totalResponses: number;
  responsesPerMinute: number;
  avgResponseInterval: number;
  lastBatchSize: number;
  isStuck: boolean;
  stuckDuration: number;
}

const STUCK_THRESHOLD_MS = 60000; // 1 minute without new responses = stuck
const CHECK_INTERVAL_MS = 5000; // Check every 5 seconds

async function monitorActiveRuns(): Promise<void> {
  console.log("🔍 Starting StreamingDatabaseWriter monitoring...\n");

  const monitoredRuns = new Map<string, MonitoringStats>();

  setInterval(async () => {
    try {
      // Get all currently running reports
      const activeRuns = await prisma.reportRun.findMany({
        where: {
          status: "RUNNING",
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        select: {
          id: true,
          stepStatus: true,
          createdAt: true,
          company: {
            select: { name: true },
          },
        },
      });

      const currentTime = performance.now();

      for (const run of activeRuns) {
        const runId = run.id;

        // Get response count for this run
        const totalResponses = await prisma.response.count({
          where: { runId },
        });

        let stats = monitoredRuns.get(runId);

        if (!stats) {
          // New run detected
          stats = {
            runId,
            startTime: currentTime,
            totalResponses,
            responsesPerMinute: 0,
            avgResponseInterval: 0,
            lastBatchSize: 0,
            isStuck: false,
            stuckDuration: 0,
          };
          console.log(`📊 New run detected: ${runId} (${run.company.name})`);
        } else {
          // Update existing stats
          const timeDiff =
            currentTime - (stats.lastResponseTime || stats.startTime);
          const responseDiff = totalResponses - stats.totalResponses;

          if (responseDiff > 0) {
            // Progress detected
            stats.lastResponseTime = currentTime;
            stats.avgResponseInterval = timeDiff / responseDiff;
            stats.lastBatchSize = responseDiff;
            stats.isStuck = false;
            stats.stuckDuration = 0;
          } else {
            // No progress
            const timeSinceLastResponse =
              currentTime - (stats.lastResponseTime || stats.startTime);
            stats.isStuck = timeSinceLastResponse > STUCK_THRESHOLD_MS;
            stats.stuckDuration = timeSinceLastResponse;
          }

          // Calculate responses per minute
          const totalTime = currentTime - stats.startTime;
          stats.responsesPerMinute = totalResponses / (totalTime / 60000);
        }

        stats.totalResponses = totalResponses;
        monitoredRuns.set(runId, stats);

        // Display status
        const status = stats.isStuck ? "🔴 STUCK" : "🟢 ACTIVE";
        const companyName = run.company.name.padEnd(20);
        const stepStatus = run.stepStatus?.padEnd(30) || "Unknown";
        const responseRate = `${stats.responsesPerMinute.toFixed(1)}/min`;
        const stuckTime = stats.isStuck
          ? `(${(stats.stuckDuration / 1000).toFixed(0)}s)`
          : "";

        console.log(
          `${status} ${companyName} | ${stepStatus} | ${stats.totalResponses.toString().padStart(4)} responses | ${responseRate.padStart(8)} ${stuckTime}`,
        );

        // Alert on stuck runs
        if (stats.isStuck && stats.stuckDuration > STUCK_THRESHOLD_MS * 2) {
          console.log(
            `⚠️  ALERT: Run ${runId} (${run.company.name}) has been stuck for ${(stats.stuckDuration / 60000).toFixed(1)} minutes!`,
          );

          // Get detailed database stats for stuck run
          await analyzeStuckRun(runId);
        }
      }

      // Clean up completed runs
      const activeRunIds = activeRuns.map((r) => r.id);
      for (const [runId, stats] of monitoredRuns.entries()) {
        if (!activeRunIds.includes(runId)) {
          console.log(`✅ Run completed: ${runId}`);
          monitoredRuns.delete(runId);
        }
      }

      if (activeRuns.length === 0) {
        console.log("💤 No active runs found");
      }

      console.log(`\n--- ${new Date().toISOString()} ---\n`);
    } catch (error) {
      console.error("❌ Monitoring error:", error);
    }
  }, CHECK_INTERVAL_MS);
}

async function analyzeStuckRun(runId: string): Promise<void> {
  try {
    console.log(`\n🔬 Analyzing stuck run: ${runId}`);

    // Check database connections
    const connectionInfo = await prisma.$queryRaw`
      SELECT 
        state,
        COUNT(*) as count
      FROM pg_stat_activity 
      WHERE datname = current_database()
      GROUP BY state
    `;

    console.log("Database connections:", connectionInfo);

    // Check for long-running transactions
    const longTransactions = await prisma.$queryRaw`
      SELECT 
        pid,
        state,
        query_start,
        state_change,
        EXTRACT(EPOCH FROM (now() - query_start)) as duration_seconds,
        LEFT(query, 100) as query_preview
      FROM pg_stat_activity 
      WHERE state != 'idle' 
        AND query_start < now() - interval '30 seconds'
      ORDER BY query_start
    `;

    if (Array.isArray(longTransactions) && longTransactions.length > 0) {
      console.log("Long-running transactions:");
      longTransactions.forEach((tx: any) => {
        console.log(
          `  PID ${tx.pid}: ${tx.duration_seconds}s - ${tx.query_preview}`,
        );
      });
    }

    // Check for locks
    const locks = await prisma.$queryRaw`
      SELECT 
        l.locktype,
        l.mode,
        l.granted,
        a.state,
        a.query_start,
        LEFT(a.query, 50) as query_preview
      FROM pg_locks l
      JOIN pg_stat_activity a ON l.pid = a.pid
      WHERE NOT l.granted
      ORDER BY a.query_start
    `;

    if (Array.isArray(locks) && locks.length > 0) {
      console.log("Blocked queries:");
      locks.forEach((lock: any) => {
        console.log(`  ${lock.locktype} ${lock.mode}: ${lock.query_preview}`);
      });
    }

    console.log("");
  } catch (error) {
    console.error("Failed to analyze stuck run:", error);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Monitoring stopped");
  process.exit(0);
});

// Start monitoring
monitorActiveRuns().catch(console.error);
