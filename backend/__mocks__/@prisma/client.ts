export const PrismaClient = jest.fn(() => ({
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  $queryRaw: jest.fn().mockResolvedValue([{ current_database: 'serplexity_test' }]),
  $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
  $transaction: jest.fn(async (callback) => {
    // Simulate a transaction by directly calling the callback
    return callback(mockPrismaClient);
  }),
  company: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  competitor: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  benchmarkingQuestion: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  product: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  visibilityResponse: {
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  },
  benchmarkResponse: {
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  },
  personalResponse: {
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  },
  // ---- New Fan-out tables ----
  fanoutResponse: {
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  },
  fanoutMention: {
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  },
  fanoutQuestion: {
    findMany: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  reportRun: {
    findMany: jest.fn(),
  },
  sentimentScore: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
}));

const mockPrismaClient = new (PrismaClient as any)();

// Re-export the mock instance for easier access in tests
export default mockPrismaClient;