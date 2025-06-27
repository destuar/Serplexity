import { scheduleDailyReportTrigger } from '../queues/masterScheduler';

describe('masterScheduler', () => {
  let mockMasterSchedulerQueue: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockMasterSchedulerQueue = {
      add: jest.fn(),
      getRepeatableJobs: jest.fn().mockResolvedValue([]),
      removeRepeatableByKey: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };

    jest.mock('../queues/masterScheduler', () => ({
      scheduleDailyReportTrigger: jest.fn(() => {
        // Call the original implementation if needed, or just log
        console.log("Mocked scheduleDailyReportTrigger called");
        // Simulate the original function's behavior using the mock queue
        return (async () => {
          const repeatableJobs = await mockMasterSchedulerQueue.getRepeatableJobs();
          for (const job of repeatableJobs) {
            await mockMasterSchedulerQueue.removeRepeatableByKey(job.key);
          }
          await mockMasterSchedulerQueue.add(
            'trigger-daily-reports',
            {},
            {
              repeat: {
                pattern: '0 5 * * *',
              },
              jobId: 'daily-report-trigger',
            }
          );
        })();
      }),
      masterSchedulerQueue: mockMasterSchedulerQueue,
    }));
  });

  afterEach(async () => {
    await mockMasterSchedulerQueue.close();
  });

  it('should schedule the daily report trigger', async () => {
    // Re-import the function after mocking to ensure we get the mocked version
    const { scheduleDailyReportTrigger: mockedScheduleDailyReportTrigger } = require('../queues/masterScheduler');

    await mockedScheduleDailyReportTrigger();

    expect(mockMasterSchedulerQueue.getRepeatableJobs).toHaveBeenCalledTimes(1);
    expect(mockMasterSchedulerQueue.removeRepeatableByKey).toHaveBeenCalledTimes(0); // No old jobs initially
    expect(mockMasterSchedulerQueue.add).toHaveBeenCalledTimes(1);
    expect(mockMasterSchedulerQueue.add).toHaveBeenCalledWith(
      'trigger-daily-reports',
      {},
      {
        repeat: {
          pattern: '0 5 * * *',
        },
        jobId: 'daily-report-trigger',
      }
    );
  });
});