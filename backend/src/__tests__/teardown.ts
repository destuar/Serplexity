import { getDbClient } from "../config/database";

// Mock instances tracking for test cleanup
const activeBullMQInstances = new Set<{ close: () => Promise<void> }>();

export const addBullMQInstance = (instance: unknown) => {
  activeBullMQInstances.add(instance);
};

export const removeBullMQInstance = (instance: unknown) => {
  activeBullMQInstances.delete(instance);
};

export default async function teardown() {
  const prisma = await getDbClient();
  // Close all active BullMQ instances (queues and workers)
  const activeInstances = Array.from(activeBullMQInstances);
  for (const instance of activeInstances) {
    if ((instance as unknown).close) {
      await (instance as unknown).close();
    }
  }

  await prisma.$disconnect();
  console.log("✅ All test connections closed.");
  process.exit(0);
}
