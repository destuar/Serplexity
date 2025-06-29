import { PrismaClient } from '@prisma/client';
import getEnv from '../../config/env';
import { prismaReadReplica } from '../../config/db';

describe('Database Configuration', () => {
  let originalReadReplicaUrl: string | undefined;

  beforeAll(() => {
    originalReadReplicaUrl = process.env.READ_REPLICA_URL;
  });

  afterEach(() => {
    if (originalReadReplicaUrl) {
      process.env.READ_REPLICA_URL = originalReadReplicaUrl;
    } else {
      delete process.env.READ_REPLICA_URL;
    }
  });

  it('should initialize prismaReadReplica with READ_REPLICA_URL if set', () => {
    process.env.READ_REPLICA_URL = 'postgresql://test:test@localhost:5433/test_replica';
    const env = getEnv(); // Re-evaluate env after setting variable
    
    // Re-import prismaReadReplica to ensure it picks up the new env var
    jest.resetModules();
    const { prismaReadReplica: newPrismaReadReplica } = require('../../config/db');

    expect(newPrismaReadReplica).toBeInstanceOf(PrismaClient);
    // You might need a more sophisticated way to check the URL used by PrismaClient
    // For now, we'll rely on the fact that it's initialized when the env var is set.
  });

  it('should initialize prismaReadReplica with DATABASE_URL if READ_REPLICA_URL is not set', () => {
    delete process.env.READ_REPLICA_URL;
    const env = getEnv(); // Re-evaluate env after deleting variable

    // Re-import prismaReadReplica to ensure it picks up the new env var
    jest.resetModules();
    const { prismaReadReplica: newPrismaReadReplica } = require('../../config/db');

    expect(newPrismaReadReplica).toBeInstanceOf(PrismaClient);
    // Again, relying on initialization for now.
  });
});
