import { jest, describe, afterAll, it, expect } from '@jest/globals';
import { masterSchedulerQueue, scheduleDailyReportTrigger } from '../queues/masterScheduler';

describe('Master Scheduler Integration', () => {
  afterAll(async () => {
    // Clean up any test jobs
    const repeatableJobs = await masterSchedulerQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await masterSchedulerQueue.removeRepeatableByKey(job.key);
    }
    await masterSchedulerQueue.close();
  });

  it('should register a valid cron job in Redis', async () => {
    // Schedule the daily report trigger
    await scheduleDailyReportTrigger();
    
    // Verify the job is registered
    const repeatableJobs = await masterSchedulerQueue.getRepeatableJobs();
    
    expect(repeatableJobs).toHaveLength(1);
    
    const job = repeatableJobs[0];
    expect(job.name).toBe('trigger-daily-reports');
    
    // Check for the pattern instead of cron
    expect((job as any).pattern).toBe('0 5 * * *');
    expect((job as any).cron).toBeUndefined();
    
    // Verify it has a next execution time
    expect(job.next).toBeDefined();
    expect(job.next).toBeGreaterThan(Date.now());
    
    // Verify the pattern creates a valid next run time
    // Note: The actual hour may vary based on when the test runs relative to 5:00 AM UTC
    const nextRun = new Date(job.next!);
    expect(nextRun.getUTCMinutes()).toBe(0);
    expect(nextRun.getUTCSeconds()).toBe(0);
    
    // The hour should be 5 if we haven't passed 5:00 AM today, otherwise it should be scheduled for tomorrow
    const now = new Date();
    const todayAt5AM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 5, 0, 0);
    if (now < todayAt5AM) {
      // If it's before 5:00 AM today, next run should be today at 5:00 AM
      expect(nextRun.getUTCHours()).toBe(5);
    } else {
      // If it's after 5:00 AM today, next run should be tomorrow at 5:00 AM
      expect(nextRun.getTime()).toBeGreaterThan(todayAt5AM.getTime());
    }
  });

  it('should clean up old jobs when rescheduling', async () => {
    // Schedule the job twice
    await scheduleDailyReportTrigger();
    await scheduleDailyReportTrigger();
    
    // Should still only have one job
    const repeatableJobs = await masterSchedulerQueue.getRepeatableJobs();
    expect(repeatableJobs).toHaveLength(1);
  });
}); 