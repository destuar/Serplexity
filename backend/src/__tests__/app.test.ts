import request from 'supertest';
import app from '../app';
import { prisma } from './setup';

describe('App Configuration', () => {
  describe('Health Endpoints', () => {
    it('should respond to basic health check', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toEqual({ status: 'UP' });
    });

    it('should respond to deep health check with database connection', async () => {
      const response = await request(app)
        .get('/api/health/deep')
        .expect(200);

      expect(response.body.status).toBe('UP');
      expect(response.body.db).toBe('UP');
    });
  });

  describe('CORS Configuration', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Unknown Routes', () => {
    it('should handle unknown API routes', async () => {
      await request(app)
        .get('/api/unknown-route')
        .expect(404);
    });
  });

  describe('Root Route', () => {
    it('should respond to root route', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.text).toBe('Hello from the Serplexity backend!');
    });
  });
}); 