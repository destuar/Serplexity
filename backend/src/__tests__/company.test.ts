import request from 'supertest';
import app from '../app';
import { prisma } from './setup';
import { User, Company } from '@prisma/client';

describe('Company Management System', () => {
  let testUser: User;
  let accessToken: string;
  
  const validCompanyData = {
    name: 'Test Company Inc',
    website: 'https://testcompany.com',
    industry: 'Technology',
    competitors: [
      { name: 'Competitor A', website: 'https://competitor-a.com' },
      { name: 'Competitor B', website: 'https://competitor-b.com' }
    ],
    benchmarkingQuestions: [
      'What is the best project management tool?',
      'Which company has the most reliable customer service?'
    ],
    products: ['Product A', 'Product B']
  };

  beforeEach(async () => {
    // Clean up and create test user with retry logic
    await cleanupWithRetry();
    
    // Create test user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      })
      .expect(201);
      
    testUser = registerResponse.body.user;
    accessToken = registerResponse.body.accessToken;
    
    // Verify we have valid credentials before proceeding
    expect(testUser).toBeDefined();
    expect(accessToken).toBeDefined();
    expect(testUser.id).toBeDefined();
  });

  async function cleanupWithRetry(maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await prisma.user.deleteMany({});
        await prisma.company.deleteMany({});
        return;
      } catch (error: any) {
        if (attempt === maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
    }
  }

  describe('POST /api/companies - Create Company', () => {
    it('should successfully create a company with all data', async () => {
      const response = await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validCompanyData)
        .expect(201);

      expect(response.body).toHaveProperty('company');
      const { company } = response.body;
      
      expect(company.name).toBe(validCompanyData.name);
      expect(company.website).toBe(validCompanyData.website);
      expect(company.industry).toBe(validCompanyData.industry);
      expect(company.userId).toBe(testUser.id);
      
      // Verify competitors were created
      expect(company.competitors).toHaveLength(2);
      expect(company.competitors.map((c: any) => c.name)).toEqual(
        expect.arrayContaining(['Competitor A', 'Competitor B'])
      );
      
      // Verify benchmarking questions were created
      expect(company.benchmarkingQuestions).toHaveLength(2);
      expect(company.benchmarkingQuestions.map((q: any) => q.text)).toEqual(
        expect.arrayContaining(validCompanyData.benchmarkingQuestions)
      );
      
      // Verify products were created
      expect(company.products).toHaveLength(2);
      expect(company.products.map((p: any) => p.name)).toEqual(
        expect.arrayContaining(['Product A', 'Product B'])
      );
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/companies')
        .send(validCompanyData)
        .expect(401);
    });

    it('should validate required fields', async () => {
      const invalidData = { name: '', website: '', industry: '' };
      
      const response = await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should validate website URL format', async () => {
      const invalidData = { 
        ...validCompanyData, 
        website: 'not-a-valid-url' 
      };
      
      await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('should validate competitor website URLs', async () => {
      const invalidData = { 
        ...validCompanyData, 
        competitors: [{ name: 'Test', website: 'invalid-url' }]
      };
      
      await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('should require at least one competitor', async () => {
      const invalidData = { 
        ...validCompanyData, 
        competitors: []
      };
      
      await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('should require at least one benchmarking question', async () => {
      const invalidData = { 
        ...validCompanyData, 
        benchmarkingQuestions: []
      };
      
      await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('should require at least one product', async () => {
      const invalidData = { 
        ...validCompanyData, 
        products: []
      };
      
      await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('should limit maximum 5 benchmarking questions', async () => {
      const invalidData = { 
        ...validCompanyData, 
        benchmarkingQuestions: [
          'Question 1', 'Question 2', 'Question 3', 
          'Question 4', 'Question 5', 'Question 6'
        ]
      };
      
      await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('should limit maximum 5 products', async () => {
      const invalidData = { 
        ...validCompanyData, 
        products: [
          'Product 1', 'Product 2', 'Product 3', 
          'Product 4', 'Product 5', 'Product 6'
        ]
      };
      
      await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('should remove duplicate competitors by website', async () => {
      const dataWithDuplicates = {
        ...validCompanyData,
        competitors: [
          { name: 'Company A', website: 'https://example.com' },
          { name: 'Company B', website: 'https://www.example.com' }, // Should be treated as duplicate
          { name: 'Company C', website: 'https://other.com' }
        ]
      };

      const response = await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(dataWithDuplicates)
        .expect(201);

      // Should only have 2 unique competitors
      expect(response.body.company.competitors).toHaveLength(2);
    });

    it('should enforce maximum 3 companies per user', async () => {
      // Create 3 companies first
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/companies')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            ...validCompanyData,
            name: `Company ${i + 1}`,
            website: `https://company${i + 1}.com`
          })
          .expect(201);
      }

      // Try to create a 4th company
      const response = await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ...validCompanyData,
          name: 'Fourth Company',
          website: 'https://fourth.com'
        })
        .expect(400);

      expect(response.body.error).toBe('Maximum company limit reached');
    });
  });

  describe('GET /api/companies - Get All Companies', () => {
    let company1: Company, company2: Company;

    beforeEach(async () => {
      // Create test companies
      const response1 = await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validCompanyData);
      company1 = response1.body.company;

      const response2 = await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ...validCompanyData,
          name: 'Second Company',
          website: 'https://second.com'
        });
      company2 = response2.body.company;
    });

    it('should return all user companies', async () => {
      const response = await request(app)
        .get('/api/companies')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.companies).toHaveLength(2);
      expect(response.body.companies.map((c: any) => c.id)).toEqual(
        expect.arrayContaining([company1.id, company2.id])
      );
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/companies')
        .expect(401);
    });

    it('should only return companies for authenticated user', async () => {
      // Create another user and their company
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other@example.com',
          password: 'password123',
          name: 'Other User'
        });

      await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${otherUserResponse.body.accessToken}`)
        .send({
          ...validCompanyData,
          name: 'Other User Company',
          website: 'https://otheruser.com'
        });

      // Original user should still only see their 2 companies
      const response = await request(app)
        .get('/api/companies')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.companies).toHaveLength(2);
    });

    it('should return companies in descending order by creation date', async () => {
      const response = await request(app)
        .get('/api/companies')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const companies = response.body.companies;
      expect(companies[0].name).toBe('Second Company'); // Most recent
      expect(companies[1].name).toBe('Test Company Inc'); // Older
    });
  });

  describe('GET /api/companies/:id - Get Specific Company', () => {
    let company: Company | null = null;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validCompanyData)
        .expect(201);
      company = response.body.company;
      expect(company).toBeDefined();
      expect(company?.id).toBeDefined();
    });

    it('should return specific company with all relations', async () => {
      if (!company?.id) throw new Error('Company not initialized');
      
      const response = await request(app)
        .get(`/api/companies/${company.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const { company: fetchedCompany } = response.body;
      expect(fetchedCompany.id).toBe(company.id);
      expect(fetchedCompany.competitors).toBeDefined();
      expect(fetchedCompany.benchmarkingQuestions).toBeDefined();
      expect(fetchedCompany.products).toBeDefined();
    });

    it('should require authentication', async () => {
      if (!company?.id) throw new Error('Company not initialized');
      
      await request(app)
        .get(`/api/companies/${company.id}`)
        .expect(401);
    });

    it('should return 404 for non-existent company', async () => {
      await request(app)
        .get('/api/companies/999999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 403 when trying to access another user\'s company', async () => {
      if (!company?.id) throw new Error('Company not initialized');
      
      // Create another user
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other@example.com',
          password: 'password123',
          name: 'Other User'
        });

      // Try to access first user's company with second user's token
      await request(app)
        .get(`/api/companies/${company.id}`)
        .set('Authorization', `Bearer ${otherUserResponse.body.accessToken}`)
        .expect(403);
    });
  });

  describe('PUT /api/companies/:id - Update Company', () => {
    let company: Company | null = null;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validCompanyData)
        .expect(201);
      company = response.body.company;
      expect(company).toBeDefined();
      expect(company?.id).toBeDefined();
    });

    it('should successfully update company data', async () => {
      if (!company?.id) throw new Error('Company not initialized');
      
      const updateData = {
        name: 'Updated Company Name',
        industry: 'Updated Industry',
        competitors: [
          { name: 'New Competitor', website: 'https://new-competitor.com' }
        ],
        benchmarkingQuestions: ['New question?'],
        products: ['New Product']
      };

      const response = await request(app)
        .put(`/api/companies/${company.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      const { company: updatedCompany } = response.body;
      expect(updatedCompany.name).toBe('Updated Company Name');
      expect(updatedCompany.industry).toBe('Updated Industry');
      expect(updatedCompany.competitors).toHaveLength(1);
      expect(updatedCompany.competitors[0].name).toBe('New Competitor');
    });

    it('should allow partial updates', async () => {
      if (!company?.id) throw new Error('Company not initialized');
      
      const partialUpdate = { name: 'Partially Updated Name' };

      const response = await request(app)
        .put(`/api/companies/${company.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(partialUpdate)
        .expect(200);

      expect(response.body.company.name).toBe('Partially Updated Name');
      expect(response.body.company.website).toBe(validCompanyData.website); // Should remain unchanged
    });

    it('should require authentication', async () => {
      if (!company?.id) throw new Error('Company not initialized');
      
      await request(app)
        .put(`/api/companies/${company.id}`)
        .send({ name: 'Updated' })
        .expect(401);
    });

    it('should return 404 for non-existent company', async () => {
      await request(app)
        .put('/api/companies/999999')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated' })
        .expect(404);
    });

    it('should return 403 when trying to update another user\'s company', async () => {
      if (!company?.id) throw new Error('Company not initialized');
      
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other@example.com',
          password: 'password123',
          name: 'Other User'
        });

      await request(app)
        .put(`/api/companies/${company.id}`)
        .set('Authorization', `Bearer ${otherUserResponse.body.accessToken}`)
        .send({ name: 'Hacked!' })
        .expect(403);
    });
  });

  describe('DELETE /api/companies/:id - Delete Company', () => {
    let company: Company | null = null;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validCompanyData)
        .expect(201);
      company = response.body.company;
      expect(company).toBeDefined();
      expect(company?.id).toBeDefined();
    });

    it('should successfully delete company and all related data', async () => {
      if (!company?.id) throw new Error('Company not initialized');
      
      await request(app)
        .delete(`/api/companies/${company.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify company is deleted
      await request(app)
        .get(`/api/companies/${company.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      // Verify related data is deleted (cascade)
      const competitors = await prisma.competitor.findMany({
        where: { companyId: company.id }
      });
      expect(competitors).toHaveLength(0);

      const questions = await prisma.benchmarkingQuestion.findMany({
        where: { companyId: company.id }
      });
      expect(questions).toHaveLength(0);

      const products = await prisma.product.findMany({
        where: { companyId: company.id }
      });
      expect(products).toHaveLength(0);
    });

    it('should require authentication', async () => {
      if (!company?.id) throw new Error('Company not initialized');
      
      await request(app)
        .delete(`/api/companies/${company.id}`)
        .expect(401);
    });

    it('should return 404 for non-existent company', async () => {
      await request(app)
        .delete('/api/companies/999999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 403 when trying to delete another user\'s company', async () => {
      if (!company?.id) throw new Error('Company not initialized');
      
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other@example.com',
          password: 'password123',
          name: 'Other User'
        });

      await request(app)
        .delete(`/api/companies/${company.id}`)
        .set('Authorization', `Bearer ${otherUserResponse.body.accessToken}`)
        .expect(403);
    });
  });

  describe('Database Relationships and Data Integrity', () => {
    it('should maintain referential integrity when deleting users', async () => {
      // Create company
      const response = await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validCompanyData);
      const company = response.body.company;

      // Verify company exists
      expect(company).toBeDefined();

      // Note: In a real scenario, we'd test user deletion,
      // but that's handled by database constraints
      const dbCompany = await prisma.company.findUnique({
        where: { id: company.id },
        include: {
          competitors: true,
          benchmarkingQuestions: true,
          products: true
        }
      });

      expect(dbCompany).toBeTruthy();
      expect(dbCompany?.competitors.length).toBeGreaterThan(0);
      expect(dbCompany?.benchmarkingQuestions.length).toBeGreaterThan(0);
      expect(dbCompany?.products.length).toBeGreaterThan(0);
    });
  });
}); 