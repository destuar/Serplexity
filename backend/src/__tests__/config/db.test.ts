// @ts-nocheck
// Mock the logger before any imports
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

jest.mock('../../utils/logger', () => mockLogger);

// Mock the env module to have complete control over configuration
jest.mock('../../config/env', () => ({
  __esModule: true,
  default: {
    DATABASE_URL: 'postgresql://test:test@primary-host:5432/test_primary',
    READ_REPLICA_URL: undefined
  }
}));

describe('Database Configuration', () => {
  let mockEnv: any;

  beforeEach(() => {
    // Clear all mock calls
    jest.clearAllMocks();
    // Get the mocked env module
    mockEnv = require('../../config/env').default;
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('should log the correct host for read replica when READ_REPLICA_URL is set', async () => {
    // Set the mock env values for this test
    mockEnv.READ_REPLICA_URL = 'postgresql://test:test@replica-host:5433/test_replica';
    
    // Import the factory function after setting the mock
    const { createPrismaClients } = await import('../../config/db');
    
    const { readReplica } = createPrismaClients({
      enableLogging: true
    });

    // Verify the correct host was logged
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('[Prisma] Initializing primary client with host: primary-host')
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('[Prisma] Initializing read replica client with host: replica-host')
    );

    // Verify the client was created with correct URL
    expect(readReplica).toBeDefined();
  });

  it('should log the correct host for read replica when READ_REPLICA_URL is not set', async () => {
    // Ensure READ_REPLICA_URL is undefined for this test
    mockEnv.READ_REPLICA_URL = undefined;
    
    // Import the factory function after setting the mock
    const { createPrismaClients } = await import('../../config/db');
    
    const { readReplica } = createPrismaClients({
      enableLogging: true
    });

    // Verify the correct host was logged
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('[Prisma] Initializing primary client with host: primary-host')
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('[Prisma] Read replica URL not set, read client will use primary host: primary-host')
    );

    // Verify the client was created with primary URL as fallback
    expect(readReplica).toBeDefined();
  });

  it('should not log when logging is disabled', async () => {
    // Import the factory function
    const { createPrismaClients } = await import('../../config/db');
    // Capture the call count before
    const callCountBefore = mockLogger.info.mock.calls.length;
    const { readReplica } = createPrismaClients({
      primaryUrl: 'postgresql://test:test@primary-host:5432/test_primary',
      replicaUrl: 'postgresql://test:test@replica-host:5433/test_replica',
      enableLogging: false
    });
    // Capture the call count after
    const callCountAfter = mockLogger.info.mock.calls.length;
    // Verify no additional logging occurred
    expect(callCountAfter).toBe(callCountBefore);
    // Verify the client was still created
    expect(readReplica).toBeDefined();
  });

  it('should handle invalid URLs gracefully', async () => {
    // Import the factory function
    const { createPrismaClients } = await import('../../config/db');
    
    const { readReplica } = createPrismaClients({
      primaryUrl: 'invalid-url',
      enableLogging: true
    });

    // Should log 'Invalid URL' for the host
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('[Prisma] Initializing primary client with host: Invalid URL')
    );

    // Verify the client was still created (Prisma will handle the invalid URL)
    expect(readReplica).toBeDefined();
  });

  it('should use provided URLs over environment variables', async () => {
    // Set environment variables
    mockEnv.READ_REPLICA_URL = 'postgresql://test:test@env-replica-host:5433/test_replica';
    
    // Import the factory function
    const { createPrismaClients } = await import('../../config/db');
    
    const { readReplica } = createPrismaClients({
      primaryUrl: 'postgresql://test:test@provided-primary-host:5432/test_primary',
      replicaUrl: 'postgresql://test:test@provided-replica-host:5433/test_replica',
      enableLogging: true
    });

    // Should use provided URLs, not environment variables
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('[Prisma] Initializing primary client with host: provided-primary-host')
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('[Prisma] Initializing read replica client with host: provided-replica-host')
    );

    expect(readReplica).toBeDefined();
  });
});
