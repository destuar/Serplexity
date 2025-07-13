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
    expect(job.id).toBe('daily-report-trigger');
    
    // Verify it has a valid cron expression (not pattern)
    expect((job as any).cron).toBe('0 5 * * *');
    expect((job as any).pattern).toBeUndefined();
    
    // Verify it has a next execution time
    expect(job.next).toBeDefined();
    expect(job.next).toBeGreaterThan(Date.now());
    
    // Verify the cron expression is valid (next run should be at 5:00 AM UTC)
    const nextRun = new Date(job.next!);
    expect(nextRun.getUTCHours()).toBe(5);
    expect(nextRun.getUTCMinutes()).toBe(0);
    expect(nextRun.getUTCSeconds()).toBe(0);
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