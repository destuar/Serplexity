import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { Job } from 'bullmq';
import { processArchiveJob } from '../queues/archiveWorker';
import { getDbClient } from '../config/database';
import { GlacierClient, UploadArchiveCommand } from '@aws-sdk/client-glacier';

// Mock Glacier client and commands
jest.mock('@aws-sdk/client-glacier', () => {
  const mockSend = jest.fn();
  return {
    GlacierClient: jest.fn(() => ({
      send: mockSend,
    })),
    UploadArchiveCommand: jest.fn(() => ({})),
    __esModule: true,
  };
});

// Create mock database client
const mockDbClient = {
  reportRun: {
    findMany: jest.fn(),
  },
  fanoutResponse: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

// Mock database client
jest.mock('../config/database', () => ({
  __esModule: true,
  getDbClient: jest.fn(() => mockDbClient),
}));

// Cast getDbClient to a mocked type
const mockedGetDbClient = getDbClient as jest.MockedFunction<typeof getDbClient>;

describe('archiveWorker', () => {
  let mockGlacierClientSend: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    const { GlacierClient } = require('@aws-sdk/client-glacier');
    mockGlacierClientSend = GlacierClient().send;

    const { Worker } = require('bullmq');
    new Worker('archive-jobs', async () => {}, { connection: {} });

    // Reset mock implementations
    mockDbClient.reportRun.findMany.mockReset();
    mockDbClient.fanoutResponse.findMany.mockReset();
    mockDbClient.fanoutResponse.deleteMany.mockReset();
    mockDbClient.$transaction.mockReset();
  });

  it('should not archive if there are 3 or fewer reports', async () => {
    mockDbClient.reportRun.findMany.mockResolvedValueOnce([
      { id: 'run1', createdAt: new Date() },
      { id: 'run2', createdAt: new Date() },
      { id: 'run3', createdAt: new Date() },
    ]);

    const job = { id: 'test-job', data: {} } as Job;
    await processArchiveJob(job);

    expect(mockDbClient.reportRun.findMany).toHaveBeenCalledTimes(1);
    // Should not proceed to delete if 3 or fewer reports
    expect(mockDbClient.fanoutResponse.deleteMany).not.toHaveBeenCalled();
  });

  it('should archive old fanout responses when more than 3 reports exist', async () => {
    // Mock having more than 3 reports
    mockDbClient.reportRun.findMany.mockResolvedValueOnce([
      { id: 'run1', createdAt: new Date('2023-01-01') },
      { id: 'run2', createdAt: new Date('2023-01-02') },
      { id: 'run3', createdAt: new Date('2023-01-03') },
      { id: 'run4', createdAt: new Date('2023-01-04') },
    ]);

    // Mock fanout responses to archive
    mockDbClient.fanoutResponse.findMany.mockResolvedValueOnce([]);

    // Mock the delete operation
    mockDbClient.fanoutResponse.deleteMany.mockResolvedValueOnce({ count: 2 });

    const job = { id: 'test-job', data: {} } as Job;
    await processArchiveJob(job);

    expect(mockDbClient.reportRun.findMany).toHaveBeenCalledTimes(1);
    // Should proceed to archive
    expect(mockDbClient.fanoutResponse.deleteMany).toHaveBeenCalledTimes(1);
    expect(mockDbClient.fanoutResponse.deleteMany).toHaveBeenCalledWith({
      where: {
        runId: { in: ['run1'] }
      }
    });
  });

  it('should not delete responses if no reports are old enough to archive', async () => {
    // Mock having more than 3 reports but all recent
    const recentDate = new Date();
    mockDbClient.reportRun.findMany.mockResolvedValueOnce([
      { id: 'run1', createdAt: recentDate },
      { id: 'run2', createdAt: recentDate },
      { id: 'run3', createdAt: recentDate },
      { id: 'run4', createdAt: recentDate },
    ]);

    const job = { id: 'test-job', data: {} } as Job;
    await processArchiveJob(job);

    expect(mockDbClient.reportRun.findMany).toHaveBeenCalledTimes(1);
    // Should not delete if no reports are old enough
    expect(mockDbClient.fanoutResponse.deleteMany).not.toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    // Mock a database error
    mockDbClient.reportRun.findMany.mockResolvedValueOnce([
      { id: 'run1', createdAt: new Date('2023-01-01') },
      { id: 'run2', createdAt: new Date('2023-01-02') },
      { id: 'run3', createdAt: new Date('2023-01-03') },
      { id: 'run4', createdAt: new Date('2023-01-04') },
    ]);

    // Mock deleteMany to throw an error
    mockDbClient.fanoutResponse.deleteMany.mockRejectedValueOnce(new Error('DB delete failed'));

    const job = { id: 'test-job', data: {} } as Job;
    
    // Should not throw but handle the error
    await expect(processArchiveJob(job)).rejects.toThrow('DB delete failed');

    expect(mockDbClient.reportRun.findMany).toHaveBeenCalledTimes(1);
    // Should attempt to delete
    expect(mockDbClient.fanoutResponse.deleteMany).toHaveBeenCalledTimes(1);
  });
});