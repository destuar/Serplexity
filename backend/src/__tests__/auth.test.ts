import request from 'supertest';
import app from '../app';
import { prisma } from './setup';
import bcrypt from 'bcrypt';

// Helper function to safely extract refresh token from cookies
function extractRefreshTokenCookie(headers: any): string {
  const cookies = Array.isArray(headers['set-cookie']) 
    ? headers['set-cookie'] 
    : [headers['set-cookie']];
  return cookies.find((cookie: string) => cookie?.startsWith('refreshToken=')) || '';
}

describe('Authentication System', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User'
  };

  beforeEach(async () => {
    // Clean up users before each test - ensure complete cleanup
    await prisma.user.deleteMany({
      where: { email: testUser.email }
    });
    
    // Add a small delay to ensure cleanup completes before next test
    await new Promise(resolve => setTimeout(resolve, 10));
  });

  describe('POST /api/auth/register', () => {
    it('should successfully register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.name).toBe(testUser.name);
      expect(response.body.user).not.toHaveProperty('password');
      
      // Verify refresh token cookie is set
      expect(response.headers['set-cookie']).toEqual(
        expect.arrayContaining([
          expect.stringContaining('refreshToken=')
        ])
      );

      // Verify user exists in database
      const dbUser = await prisma.user.findUnique({
        where: { email: testUser.email }
      });
      expect(dbUser).toBeTruthy();
      expect(dbUser?.email).toBe(testUser.email);
    });

    it('should reject registration with invalid email', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123'
        })
        .expect(400);
    });

    it('should reject registration with weak password', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: '123'
        })
        .expect(400);
    });

    it('should reject registration if user already exists', async () => {
      // Create user first
      await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      // Try to register again
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(400);

      expect(response.body.error).toBe('User already exists');
    });

    it('should hash password correctly', async () => {
      await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      const dbUser = await prisma.user.findUnique({
        where: { email: testUser.email }
      });

      expect(dbUser?.password).toBeDefined();
      expect(dbUser?.password).not.toBe(testUser.password);
      
      // Verify password is properly hashed
      const isValidPassword = await bcrypt.compare(testUser.password, dbUser?.password || '');
      expect(isValidPassword).toBe(true);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Ensure clean state before creating test user
      await prisma.user.deleteMany({
        where: { email: testUser.email }
      });
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Create a test user for login tests
      await request(app)
        .post('/api/auth/register')
        .send(testUser);
    });

    it('should successfully login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user).not.toHaveProperty('password');
      
      // Verify refresh token cookie is set
      expect(response.headers['set-cookie']).toEqual(
        expect.arrayContaining([
          expect.stringContaining('refreshToken=')
        ])
      );
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject login with invalid email format', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: testUser.password
        })
        .expect(400);
    });

    it('should reject login with missing password', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email
        })
        .expect(400);
    });
  });

  describe('POST /api/auth/logout', () => {
    let accessToken: string;
    let refreshTokenCookie: string;

    beforeEach(async () => {
      // Ensure clean state before creating test user
      await prisma.user.deleteMany({
        where: { email: testUser.email }
      });
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Register and login to get tokens
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      accessToken = loginResponse.body.accessToken;
      refreshTokenCookie = extractRefreshTokenCookie(loginResponse.headers);
    });

    it('should successfully logout and clear refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', refreshTokenCookie)
        .expect(200);

      expect(response.body.message).toBe('Logged out successfully');
      
      // Verify refresh token cookie is cleared
      expect(response.headers['set-cookie']).toEqual(
        expect.arrayContaining([
          expect.stringContaining('refreshToken=;')
        ])
      );
    });

    it('should increment token version on logout', async () => {
      const userBefore = await prisma.user.findUnique({
        where: { email: testUser.email }
      });
      const initialTokenVersion = userBefore?.tokenVersion || 0;

      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const userAfter = await prisma.user.findUnique({
        where: { email: testUser.email }
      });
      
      expect(userAfter?.tokenVersion).toBe(initialTokenVersion + 1);
    });

    it('should require authentication for logout', async () => {
      await request(app)
        .post('/api/auth/logout')
        .expect(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshTokenCookie: string;
    let userId: string;

    beforeEach(async () => {
      // Ensure clean state before creating test user
      await prisma.user.deleteMany({
        where: { email: testUser.email }
      });
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Register and login to get refresh token
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      refreshTokenCookie = extractRefreshTokenCookie(loginResponse.headers);
      userId = loginResponse.body.user.id;
    });

    it('should successfully refresh tokens with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.email).toBe(testUser.email);
      
      // Verify new refresh token cookie is set
      expect(response.headers['set-cookie']).toEqual(
        expect.arrayContaining([
          expect.stringContaining('refreshToken=')
        ])
      );
    });

    it('should increment token version on refresh', async () => {
      const userBefore = await prisma.user.findUnique({
        where: { id: userId }
      });
      const initialTokenVersion = userBefore?.tokenVersion || 0;

      await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .expect(200);

      const userAfter = await prisma.user.findUnique({
        where: { id: userId }
      });
      
      expect(userAfter?.tokenVersion).toBe(initialTokenVersion + 1);
    });

    it('should reject refresh without refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .expect(401);

      expect(response.body.error).toBe('Refresh token not found');
    });

    it('should reject refresh with invalid token version', async () => {
      // Manually increment token version to invalidate refresh token
      await prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } }
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .expect(401);

      expect(response.body.error).toBe('Invalid refresh token');
    });
  });

  describe('GET /api/auth/me', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Ensure clean state before creating test user
      await prisma.user.deleteMany({
        where: { email: testUser.email }
      });
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Register and login to get access token
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      accessToken = loginResponse.body.accessToken;
    });

    it('should return user data with valid access token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should reject request without access token', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });

    it('should reject request with invalid access token', async () => {
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Token Security', () => {
    it('should invalidate all tokens after logout', async () => {
      // Ensure clean state before creating test user
      await prisma.user.deleteMany({
        where: { email: testUser.email }
      });
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Register and login
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      const accessToken = loginResponse.body.accessToken;
      const refreshTokenCookie = extractRefreshTokenCookie(loginResponse.headers);

      // Verify tokens work
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Try to use old refresh token (should fail due to incremented token version)
      await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .expect(401);
    });

    it('should not reuse refresh tokens', async () => {
      // Ensure clean state before creating test user
      await prisma.user.deleteMany({
        where: { email: testUser.email }
      });
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Register and login
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      const refreshTokenCookie = extractRefreshTokenCookie(loginResponse.headers);

      // Use refresh token once
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .expect(200);

      // Try to use the same refresh token again (should fail)
      await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .expect(401);
    });
  });
}); 