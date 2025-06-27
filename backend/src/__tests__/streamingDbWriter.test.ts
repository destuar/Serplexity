import { StreamingDatabaseWriter } from '../queues/streaming-db-writer';
import { PrismaClient } from '@prisma/client';

declare type TxClient = {
  $executeRawUnsafe: jest.Mock;
  visibilityResponse: any;
  benchmarkResponse: any;
  personalResponse: any;
  visibilityMention: any;
  benchmarkMention: any;
  personalMention: any;
};

// Helper to create a nested mock for createMany / createManyAndReturn
function createMockTable() {
  return {
    createMany: jest.fn().mockResolvedValue(undefined),
    createManyAndReturn: jest.fn().mockImplementation(async ({ data }: { data: any[] }) => {
      // Simulate DB "RETURNING" by mapping each item with an id
      return data.map((d, idx) => ({ id: `resp-${Math.random().toString(36).slice(2)}-${idx}`, ...d }));
    }),
  };
}

function createMockPrisma(): PrismaClient {
  const txTemplate: TxClient = {
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    visibilityResponse: createMockTable(),
    benchmarkResponse: createMockTable(),
    personalResponse: createMockTable(),
    visibilityMention: { createMany: jest.fn().mockResolvedValue(undefined) },
    benchmarkMention: { createMany: jest.fn().mockResolvedValue(undefined) },
    personalMention: { createMany: jest.fn().mockResolvedValue(undefined) },
  } as any;

  // When writer calls prisma.$transaction(fn, opts) we execute fn with txTemplate
  const prismaMock: any = {
    $transaction: jest.fn().mockImplementation(async (cb) => cb(txTemplate)),
  };
  // Spread tables at top level too (writer never uses at top level, but safe)
  Object.assign(prismaMock, txTemplate);
  return prismaMock as unknown as PrismaClient;
}

describe('StreamingDatabaseWriter', () => {
  const companyId = 'company-123';
  const runId = 'run-123';
  const entities = [
    { id: companyId, name: 'Acme Corp' },
    { id: 'competitor-1', name: 'Globex' },
  ];

  it('flushes buffered responses, writes mentions, and updates stats', async () => {
    const prisma = createMockPrisma();
    const writer = new StreamingDatabaseWriter(prisma, runId, companyId, entities, {
      maxBatchSize: 10,
      flushIntervalMs: 999999, // disable timer-driven flush for test
    });

    // Create two responses with <brand> tags (company & competitor)
    await writer.streamResponse({
      questionId: 'q1',
      answer: 'Answer mentioning <brand>Acme Corp</brand> and <brand>Globex</brand>.',
      modelId: 'gpt-4o',
      engine: 'gpt-4o',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      questionType: 'visibility',
    });

    await writer.streamResponse({
      questionId: 'q2',
      answer: 'Only mentions <brand>Acme Corp</brand>.',
      modelId: 'gpt-4o',
      engine: 'gpt-4o',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      questionType: 'benchmark',
    });

    const statsBeforeFinalize = (writer as any).stats;
    expect(statsBeforeFinalize.responsesWritten).toBe(0);

    // Force flush and finalize
    const finalStats = await writer.finalize();

    // Ensure createMany / mentions were invoked
    const { visibilityResponse, benchmarkResponse, visibilityMention, benchmarkMention } = prisma as any;
    expect(visibilityResponse.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(benchmarkResponse.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(visibilityMention.createMany).toHaveBeenCalled();
    expect(benchmarkMention.createMany).toHaveBeenCalled();

    // Stats updated
    expect(finalStats.responsesWritten).toBe(2);
    expect(finalStats.mentionsWritten).toBe(3); // 2 + 1
    expect(finalStats.batchesProcessed).toBeGreaterThan(0);
  });
}); 