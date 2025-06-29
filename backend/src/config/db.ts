import { PrismaClient } from '@prisma/client';
import env from './env';
import logger from '../utils/logger';

// Log the database URLs being used for easier debugging
const primaryUrl = env.DATABASE_URL;
const replicaUrl = env.READ_REPLICA_URL || env.DATABASE_URL;

// Mask credentials in logs, show only hostnames
const getHost = (url: string) => {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (e) {
        return 'Invalid URL';
    }
};

logger.info(`[Prisma] Initializing primary client with host: ${getHost(primaryUrl)}`);
if (env.READ_REPLICA_URL) {
  logger.info(`[Prisma] Initializing read replica client with host: ${getHost(replicaUrl)}`);
} else {
  logger.info(`[Prisma] Read replica URL not set, read client will use primary host: ${getHost(primaryUrl)}`);
}


// This is the single, shared instance of PrismaClient
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: primaryUrl,
    },
  },
});

// For dashboard and analytical queries
export const prismaReadReplica = new PrismaClient({
  datasources: {
    db: {
      // Use the read replica URL if available, otherwise fall back to the primary
      url: replicaUrl,
    },
  },
});

export default prisma;