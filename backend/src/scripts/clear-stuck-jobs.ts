#!/usr/bin/env ts-node
/**
 * Clear stuck active jobs from the queue
 */

import { Queue } from "bullmq";
import { getBullMQOptions } from "../config/bullmq";

async function clearStuckJobs() {
  try {
    const queue = new Queue("report-generation", getBullMQOptions());
    
    console.log("🔍 Checking for stuck active jobs...");
    
    const active = await queue.getActive();
    
    if (active.length === 0) {
      console.log("✅ No active jobs found");
      await queue.close();
      return;
    }
    
    console.log(`⚠️  Found ${active.length} active jobs:`);
    
    for (const job of active) {
      const age = Date.now() - job.timestamp;
      console.log(`   - Job ${job.id}: Age ${Math.round(age/1000)}s, RunId: ${job.data?.runId}`);
      
      // If job is older than 2 minutes, it's likely stalled
      if (age > 120000) {
        console.log(`🔧 Moving stalled job ${job.id} back to failed state...`);
        try {
          await job.moveToFailed(new Error("Manually cleared stuck active job"), "0");
          console.log(`✅ Job ${job.id} moved to failed state`);
        } catch (error) {
          console.error(`❌ Failed to move job ${job.id}:`, error);
        }
      }
    }
    
    // Check final status
    const finalActive = await queue.getActive();
    console.log(`📊 Final status: ${finalActive.length} active jobs remaining`);
    
    await queue.close();
    console.log("✅ Queue cleanup complete");
    
  } catch (error) {
    console.error("❌ Failed to clear stuck jobs:", error);
    process.exit(1);
  }
}

clearStuckJobs().catch(console.error);