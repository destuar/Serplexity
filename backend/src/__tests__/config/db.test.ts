import { jest, describe, beforeEach, it, expect } from '@jest/globals';

// Mock logger module
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

// Mock PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    $connect: jest.fn().mockImplementation(() => Promise.resolve()),
    $disconnect: jest.fn().mockImplementation(() => Promise.resolve()),
  })),
}));

// Mock secrets provider
jest.mock('../../services/secretsProvider', () => ({
  SecretsProviderFactory: {
    createProvider: jest.fn().mockReturnValue({
      getSecret: jest.fn().mockImplementation(() =>
        Promise.resolve({
          secret: {
            host: 'secret-host',
            port: 5432,
            username: 'secret-user',
            password: 'secret-pass',
            database: 'secret-db',
          },
        }),
      ),
      testConnection: jest.fn().mockImplementation(() => Promise.resolve(true)),
      getProviderName: jest.fn().mockReturnValue('mock'),
    }),
  },
}));

// Mock environment
jest.mock('../../config/env', () => ({
  __esModule: true,
  default: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@primary-host:5432/test_primary',
    READ_REPLICA_URL: '',
    SECRETS_PROVIDER: 'env',
  },
}));

describe('Database Configuration', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should export database service', async () => {
    const { databaseService } = await import('../../config/database');
    expect(databaseService).toBeDefined();
  });

  it('should export getDbClient function', async () => {
    const { getDbClient } = await import('../../config/database');
    expect(getDbClient).toBeDefined();
    expect(typeof getDbClient).toBe('function');
  });

  it('should export getReadDbClient function', async () => {
    const { getReadDbClient } = await import('../../config/database');
    expect(getReadDbClient).toBeDefined();
    expect(typeof getReadDbClient).toBe('function');
  });

  it('should export testDbConnection function', async () => {
    const { testDbConnection } = await import('../../config/database');
    expect(testDbConnection).toBeDefined();
    expect(typeof testDbConnection).toBe('function');
  });

  it('should return database clients', async () => {
    const { databaseService } = await import('../../config/database');
    
    const primaryClient = databaseService.getPrimaryClient();
    const replicaClient = databaseService.getReplicaClient();
    
    expect(primaryClient).toBeDefined();
    expect(replicaClient).toBeDefined();
  });

  it('should call getDbClient without throwing', async () => {
    const { getDbClient } = await import('../../config/database');
    
    expect(() => {
      const client = getDbClient();
      expect(client).toBeDefined();
    }).not.toThrow();
  });
});
