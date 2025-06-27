import prisma from '../config/db';
import { getActiveBullMQInstances } from '../../__mocks__/bullmq';


export default async function teardown() {
  // Close all active BullMQ instances (queues and workers)
  const activeInstances = getActiveBullMQInstances();
  for (const instance of activeInstances) {
    if ((instance as any).close) {
      await (instance as any).close();
    }
  }

  await prisma.$disconnect();
  console.log('✅ All test connections closed.');
}