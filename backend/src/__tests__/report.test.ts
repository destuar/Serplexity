import request from 'supertest';
import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import app from '../app';
import { prisma } from './setup';

// Mock environment
jest.mock('../config/env', () => ({
  __esModule: true,
  default: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@primary-host:5432/test_primary',
    READ_REPLICA_URL: '',
    SECRETS_PROVIDER: 'env',
  },
}));

// Mock passport configuration
jest.mock('../config/passport', () => ({}));

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => {
    return {
      checkout: {
        sessions: {
          create: jest.fn(),
        },
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
    };
  });
});

// Mock the queueReport function so we do not interact with BullMQ / Redis during tests
jest.mock('../services/reportSchedulingService', () => {
  return {
    queueReport: jest.fn(),
  };
});

import { queueReport } from '../services/reportSchedulingService';
const mockedQueueReport = queueReport as jest.MockedFunction<typeof queueReport>;

describe('Report Generation Flow', () => {
  let accessToken: string;
  let companyId: string;

  // Helper to register user, activate subscription, and create a test company
  async function bootstrapUserAndCompany() {
    // Register
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'reportuser@example.com',
        password: 'strongpassword',
        name: 'Report Tester',
      })
      .expect(201);

    accessToken = registerRes.body.accessToken;
    const userId = registerRes.body.user.id;

    // Manually activate subscription for paymentGuard
    await prisma.user.update({
      where: { id: userId },
      data: { subscriptionStatus: 'active' },
    });

    // Create a minimal valid company
    const companyRes = await request(app)
      .post('/api/companies')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Report Test Co',
        website: 'https://reporttest.com',
        industry: 'Technology',
        competitors: [
          { name: 'Competitor One', website: 'https://comp1.com' },
        ],
        benchmarkingQuestions: ['What is the market share of top cloud providers?'],
        products: ['Product X'],
      })
      .expect(201);

    companyId = companyRes.body.company.id;
  }

  beforeEach(async () => {
    // Clean DB happens in global setup beforeEach; just bootstrap new user & company
    await bootstrapUserAndCompany();
  });

  it('should require authentication when creating a report', async () => {
    await request(app)
      .post(`/api/reports/companies/${companyId}`)
      .expect(401);
  });

  it('should forbid users without active subscription', async () => {
    // Downgrade subscription
    const user = await prisma.user.findFirst({ where: { email: 'reportuser@example.com' } });
    if (user) {
      await prisma.user.update({ where: { id: user.id }, data: { subscriptionStatus: 'inactive' } });
    }

    await request(app)
      .post(`/api/reports/companies/${companyId}`)
      .expect(403);
  });

  it('should queue a new report and return 202 with runId', async () => {
    mockedQueueReport.mockResolvedValueOnce({
      isNew: true,
      runId: 'test-run-id',
      status: 'PENDING',
    } as any);

    const res = await request(app)
      .post(`/api/reports/companies/${companyId}`)
      .expect(202);

    expect(res.body).toEqual({
      message: 'Report generation has been queued',
      runId: 'test-run-id',
    });

    expect(mockedQueueReport).toHaveBeenCalledWith(companyId, false);
  });

  it('should return 200 when report already exists / not new', async () => {
    mockedQueueReport.mockResolvedValueOnce({
      isNew: false,
      runId: 'existing-run-id',
      status: 'COMPLETED',
    } as any);

    const res = await request(app)
      .post(`/api/reports/companies/${companyId}`)
      .expect(200);

    expect(res.body).toEqual({
      message: 'A report for today has already been generated or is in progress.',
      runId: 'existing-run-id',
      status: 'COMPLETED',
    });
  });
}); 