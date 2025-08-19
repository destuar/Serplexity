#!/usr/bin/env ts-node
/**
 * Test script to add a report generation job directly to the queue
 */

import { Queue } from "bullmq";
import { getBullMQOptions, getJobOptions } from "../config/bullmq";

async function testReportQueue() {
  try {
    const queue = new Queue("report-generation", getBullMQOptions());
    
    console.log("🔍 Adding test report job to queue...");
    
    // Add a test job
    const job = await queue.add(
      "report-generation",
      {
        runId: "test-run-" + Date.now(),
        company: {
          id: "test-company-id",
          name: "Test Company"
        }
      },
      getJobOptions("report-generation")
    );
    
    console.log(`✅ Test job added: ${job.id}`);
    
    // Check queue status after adding job
    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    
    console.log(`📊 Queue status after adding job:`);
    console.log(`   - Waiting: ${waiting.length}`);
    console.log(`   - Active: ${active.length}`);
    
    await queue.close();
    console.log("✅ Test complete");
    
  } catch (error) {
    console.error("❌ Failed to test queue:", error);
    process.exit(1);
  }
}

testReportQueue().catch(console.error);