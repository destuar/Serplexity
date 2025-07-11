
import { PrismaClient } from '@prisma/client';
import env from './env';
import logger from '../utils/logger';

// Log the database URLs being used for easier debugging
const getHost = (url: string) => {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (e) {
        return 'Invalid URL';
    }
};

// Factory function for creating Prisma clients with logging
export const createPrismaClients = (config?: {
  primaryUrl?: string;
  replicaUrl?: string | undefined;
  enableLogging?: boolean;
}) => {
  const primaryUrl = config?.primaryUrl || env.DATABASE_URL;
  const replicaUrl = config?.replicaUrl !== undefined ? config.replicaUrl : (env.READ_REPLICA_URL || env.DATABASE_URL);
  const enableLogging = config?.enableLogging ?? true;

  if (enableLogging) {
    logger.info(`[Prisma] Initializing primary client with host: ${getHost(primaryUrl)}`);
    if (config?.replicaUrl !== undefined && config.replicaUrl) {
      logger.info(`[Prisma] Initializing read replica client with host: ${getHost(replicaUrl)}`);
    } else if (config?.replicaUrl === undefined && env.READ_REPLICA_URL) {
      logger.info(`[Prisma] Initializing read replica client with host: ${getHost(replicaUrl)}`);
    } else {
      logger.info(`[Prisma] Read replica URL not set, read client will use primary host: ${getHost(primaryUrl)}`);
    }
  }

  const primary = new PrismaClient({
    datasources: {
      db: {
        url: primaryUrl,
      },
    },
  });

  const readReplica = new PrismaClient({
    datasources: {
      db: {
        url: replicaUrl,
      },
    },
  });

  return { primary, readReplica };
};

// Create the default instances for production use
const { primary: prisma, readReplica: prismaReadReplica } = createPrismaClients();

export { prismaReadReplica };
export default prisma;