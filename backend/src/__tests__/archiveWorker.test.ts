import { Job } from 'bullmq';
import { processArchiveJob } from '../queues/archiveWorker'; // Import the function directly
import prisma from '../config/db';
import { GlacierClient, UploadArchiveCommand } from '@aws-sdk/client-glacier';
import { PrismaClient } from '@prisma/client';



// Mock Glacier client and commands
jest.mock('@aws-sdk/client-glacier', () => {
  const mockSend = jest.fn();
  return {
    GlacierClient: jest.fn(() => ({
      send: mockSend,
    })),
    UploadArchiveCommand: jest.fn(() => ({})),
    __esModule: true, // This is important for default exports
  };
});

// Mock prisma client
jest.mock('../config/db', () => ({
  __esModule: true,
  default: {
    reportRun: {
      findMany: jest.fn(),
    },
    visibilityResponse: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    benchmarkResponse: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    personalResponse: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// Cast prisma to a mocked type for easier access to mock methods
const mockedPrisma = prisma as jest.Mocked<PrismaClient & {
  reportRun: { findMany: jest.Mock };
  visibilityResponse: { findMany: jest.Mock; deleteMany: jest.Mock };
  benchmarkResponse: { findMany: jest.Mock; deleteMany: jest.Mock };
  personalResponse: { findMany: jest.Mock; deleteMany: jest.Mock };
  $transaction: jest.Mock;
}>;

describe('archiveWorker', () => {
  let mockGlacierClientSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure GlacierClient is mocked before accessing its instance
    const { GlacierClient } = require('@aws-sdk/client-glacier');
    mockGlacierClientSend = GlacierClient().send;

    // Explicitly create a Worker instance to trigger the mockImplementation
    // and set global.__archiveJobProcessor
    const { Worker } = require('bullmq');
    new Worker('archive-jobs', async () => {}, { connection: {} });

    // Reset mock implementations for prisma methods
    mockedPrisma.reportRun.findMany.mockReset();
    mockedPrisma.visibilityResponse.findMany.mockReset();
    mockedPrisma.visibilityResponse.deleteMany.mockReset();
    mockedPrisma.benchmarkResponse.findMany.mockReset();
    mockedPrisma.benchmarkResponse.deleteMany.mockReset();
    mockedPrisma.personalResponse.findMany.mockReset();
    mockedPrisma.personalResponse.deleteMany.mockReset();
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
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
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
    mockedPrisma.visibilityResponse.findMany.mockResolvedValueOnce([]);
    mockedPrisma.benchmarkResponse.findMany.mockResolvedValueOnce([]);
    mockedPrisma.personalResponse.findMany.mockResolvedValueOnce([]);
    mockGlacierClientSend.mockResolvedValueOnce({ archiveId: 'glacier-archive-id' });
    mockedPrisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
      // Create a mock transaction client that includes the necessary deleteMany methods
      const mockTx = {
        visibilityResponse: { deleteMany: jest.fn() },
        benchmarkResponse: { deleteMany: jest.fn() },
        personalResponse: { deleteMany: jest.fn() },
        $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
        $queryRaw: jest.fn().mockResolvedValue([]),
      };
      // Call the original callback with the mock transaction client
      await callback(mockTx);
    });

        const job = { name: 'archive-old-responses', data: { companyId: 'company1' } } as Job;
    await processArchiveJob(job);

    expect(mockedPrisma.reportRun.findMany).toHaveBeenCalledTimes(1);
    expect(mockGlacierClientSend).toHaveBeenCalledTimes(1);
    expect(mockGlacierClientSend).toHaveBeenCalledWith(expect.any(UploadArchiveCommand));
    expect(mockedPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.visibilityResponse.deleteMany).toHaveBeenCalledWith({ where: { runId: { in: ['run2', 'run1'] } } });
    expect(mockedPrisma.benchmarkResponse.deleteMany).toHaveBeenCalledWith({ where: { runId: { in: ['run2', 'run1'] } } });
    expect(mockedPrisma.personalResponse.deleteMany).toHaveBeenCalledWith({ where: { runId: { in: ['run2', 'run1'] } } });
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
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled(); // Should not proceed to delete
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
    mockedPrisma.$transaction.mockImplementation(async (callback: (tx: PrismaClient) => Promise<any>) => {
      // Simulate an error during deletion within the transaction
      // The error should be thrown by the transaction itself, not by the mocked deleteMany
      // To achieve this, we'll make the callback itself throw an error after the first call
      await callback(mockedPrisma as unknown as PrismaClient);
      throw new Error('DB delete failed');
    });

        const job = { name: 'archive-old-responses', data: { companyId: 'company1' } } as Job;
    
    await expect(processArchiveJob(job)).rejects.toThrow('DB delete failed');

    expect(mockedPrisma.reportRun.findMany).toHaveBeenCalledTimes(1);
    expect(mockGlacierClientSend).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.visibilityResponse.deleteMany).toHaveBeenCalledTimes(1);
  });
});