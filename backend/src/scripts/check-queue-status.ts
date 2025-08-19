#!/usr/bin/env ts-node
/**
 * Check queue status script for debugging
 */

import { Queue } from "bullmq";
import { getBullMQOptions } from "../config/bullmq";

async function checkQueueStatus() {
  try {
    const queue = new Queue("report-generation", getBullMQOptions());
    
    console.log("🔍 Checking queue status...");
    
    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    const completed = await queue.getCompleted();
    const failed = await queue.getFailed();
    
    console.log(`📊 Queue Status:`);
    console.log(`   - Waiting: ${waiting.length}`);
    console.log(`   - Active: ${active.length}`);
    console.log(`   - Completed: ${completed.length}`);
    console.log(`   - Failed: ${failed.length}`);
    
    if (active.length > 0) {
      console.log(`\n🔄 Active Jobs:`);
      for (const job of active) {
        const age = Date.now() - job.timestamp;
        console.log(`   - Job ${job.id}: ${job.name} (Age: ${Math.round(age/1000)}s, RunId: ${job.data?.runId})`);
      }
    }
    
    if (failed.length > 0) {
      console.log(`\n❌ Recent Failed Jobs:`);
      for (const job of failed.slice(0, 3)) {
        const age = Date.now() - job.timestamp;
        console.log(`   - Job ${job.id}: ${job.name} (Age: ${Math.round(age/1000)}s, Reason: ${job.failedReason})`);
      }
    }
    
    await queue.close();
    console.log("✅ Queue status check complete");
    
  } catch (error) {
    console.error("❌ Failed to check queue status:", error);
    process.exit(1);
  }
}

checkQueueStatus().catch(console.error);