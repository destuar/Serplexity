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

// Mock prisma client
jest.mock('../config/db', () => ({
  __esModule: true,
  default: {
    reportRun: {
      findMany: jest.fn(),
    },
    fanoutResponse: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// Cast prisma to a mocked type
const mockedPrisma = prisma as any;

describe('archiveWorker', () => {
  let mockGlacierClientSend: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    const { GlacierClient } = require('@aws-sdk/client-glacier');
    mockGlacierClientSend = GlacierClient().send;

    const { Worker } = require('bullmq');
    new Worker('archive-jobs', async () => {}, { connection: {} });

    // Reset mock implementations
    mockedPrisma.reportRun.findMany.mockReset();
    mockedPrisma.fanoutResponse.findMany.mockReset();
    mockedPrisma.fanoutResponse.deleteMany.mockReset();
    mockedPrisma.$transaction.mockReset();
  });

  it('should not archive if there are 3 or fewer reports', async () => {
    mockedPrisma.reportRun.findMany.mockResolvedValueOnce([
      { id: 'run1', createdAt: new Date() },
      { id: 'run2', createdAt: new Date() },
      { id: 'run3', createdAt: new Date() },
    ]);

    const job = { name: 'archive-old-responses', data: { companyId: 'company1' } } as Job;
    await processArchiveJob(job);

    expect(mockedPrisma.reportRun.findMany).toHaveBeenCalledTimes(1);
    expect(mockGlacierClientSend).not.toHaveBeenCalled();
    expect(mockedPrisma.fanoutResponse.deleteMany).not.toHaveBeenCalled();
  });

  it('should archive and delete old reports if more than 3', async () => {
    const oldDate = new Date('2023-01-01');
    const newDate = new Date();
    mockedPrisma.reportRun.findMany.mockResolvedValueOnce([
      { id: 'run5', createdAt: newDate },
      { id: 'run4', createdAt: newDate },
      { id: 'run3', createdAt: new Date() },
      { id: 'run2', createdAt: oldDate },
      { id: 'run1', createdAt: oldDate },
    ]);
    mockedPrisma.fanoutResponse.findMany.mockResolvedValueOnce([]);
    mockGlacierClientSend.mockResolvedValueOnce({ archiveId: 'glacier-archive-id' });
    mockedPrisma.fanoutResponse.deleteMany.mockResolvedValueOnce({ count: 2 });

    const job = { name: 'archive-old-responses', data: { companyId: 'company1' } } as Job;
    await processArchiveJob(job);

    expect(mockedPrisma.reportRun.findMany).toHaveBeenCalledTimes(1);
    expect(mockGlacierClientSend).toHaveBeenCalledTimes(1);
    expect(mockGlacierClientSend).toHaveBeenCalledWith(expect.any(Object));
    expect(mockedPrisma.fanoutResponse.deleteMany).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.fanoutResponse.deleteMany).toHaveBeenCalledWith({ 
      where: { runId: { in: ['run2', 'run1'] } } 
    });
  });

  it('should handle errors during archiving', async () => {
    mockedPrisma.reportRun.findMany.mockResolvedValueOnce([
      { id: 'run5', createdAt: new Date() },
      { id: 'run4', createdAt: new Date() },
      { id: 'run3', createdAt: new Date() },
      { id: 'run2', createdAt: new Date('2023-01-01') },
      { id: 'run1', createdAt: new Date('2023-01-01') },
    ]);
    mockGlacierClientSend.mockRejectedValueOnce(new Error('Glacier upload failed'));

    const job = { name: 'archive-old-responses', data: { companyId: 'company1' } } as Job;
    
    await expect(processArchiveJob(job)).rejects.toThrow('Glacier upload failed');

    expect(mockedPrisma.reportRun.findMany).toHaveBeenCalledTimes(1);
    expect(mockGlacierClientSend).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.fanoutResponse.deleteMany).not.toHaveBeenCalled();
  });

  it('should handle errors during deletion', async () => {
    mockedPrisma.reportRun.findMany.mockResolvedValueOnce([
      { id: 'run5', createdAt: new Date() },
      { id: 'run4', createdAt: new Date() },
      { id: 'run3', createdAt: new Date() },
      { id: 'run2', createdAt: new Date('2023-01-01') },
      { id: 'run1', createdAt: new Date('2023-01-01') },
    ]);
    mockGlacierClientSend.mockResolvedValueOnce({ archiveId: 'glacier-archive-id' });
    mockedPrisma.fanoutResponse.deleteMany.mockRejectedValueOnce(new Error('DB delete failed'));

    const job = { name: 'archive-old-responses', data: { companyId: 'company1' } } as Job;
    
    await expect(processArchiveJob(job)).rejects.toThrow('DB delete failed');

    expect(mockedPrisma.reportRun.findMany).toHaveBeenCalledTimes(1);
    expect(mockGlacierClientSend).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.fanoutResponse.deleteMany).toHaveBeenCalledTimes(1);
  });
});