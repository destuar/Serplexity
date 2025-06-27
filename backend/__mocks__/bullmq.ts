import { jest } from '@jest/globals';

const activeBullMQInstances = new Set();

const mockBullMQInstance = () => ({
  on: jest.fn(),
  close: jest.fn().mockImplementation(async () => {
    activeBullMQInstances.delete(mockBullMQInstance);
    return Promise.resolve();
  }),
  add: jest.fn(),
  getRepeatableJobs: jest.fn().mockResolvedValue([] as any),
  removeRepeatableByKey: jest.fn(),
});

export const Worker = jest.fn(() => {
  const instance = mockBullMQInstance();
  activeBullMQInstances.add(instance);
  return instance;
});

export const Queue = jest.fn(() => {
  const instance = mockBullMQInstance();
  activeBullMQInstances.add(instance);
  return instance;
});

export const getActiveBullMQInstances = () => Array.from(activeBullMQInstances);