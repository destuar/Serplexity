import { getDbClient } from "../config/database";

// Mock instances tracking for test cleanup
const activeBullMQInstances = new Set<any>();

export const addBullMQInstance = (instance: any) => {
  activeBullMQInstances.add(instance);
};

export const removeBullMQInstance = (instance: any) => {
  activeBullMQInstances.delete(instance);
};

export default async function teardown() {
  const prisma = await getDbClient();
  // Close all active BullMQ instances (queues and workers)
  const activeInstances = Array.from(activeBullMQInstances);
  for (const instance of activeInstances) {
    if ((instance as any).close) {
      await (instance as any).close();
    }
  }

  await prisma.$disconnect();
  console.log("✅ All test connections closed.");
  process.exit(0);
}
