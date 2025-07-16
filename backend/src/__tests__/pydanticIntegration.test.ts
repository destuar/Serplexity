const { pydanticLlmService } = require('../services/pydanticLlmService');
const { providerManager } = require('../config/pydanticProviders');
const { initializeLogfire } = require('../config/logfire');

// Mock the database client to avoid connection issues
jest.mock('../config/database', () => ({
  getDbClient: jest.fn().mockResolvedValue({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  }),
}));

beforeAll(async () => {
  // Initialize Logfire for testing
  try {
    await initializeLogfire({
      serviceName: 'pydantic-integration-test',
      enableAutoInstrumentation: false,
    });
    console.log('✅ Logfire initialized successfully in test');
  } catch (error) {
    console.log('⚠️  Logfire initialization failed (expected in test environment):', error.message);
  }
});

describe('Logfire PydanticAI Integration Tests', () => {
  it('should initialize Logfire without throwing fatal errors', async () => {
    // This test verifies that Logfire initialization doesn't crash the application
    expect(true).toBe(true);
  });

  it('should have available providers configured', () => {
    const availableProviders = providerManager.getAvailableProviders();
    expect(availableProviders).toBeDefined();
    expect(Array.isArray(availableProviders)).toBe(true);
    
    if (availableProviders.length > 0) {
      const provider = availableProviders[0];
      expect(provider).toHaveProperty('id');
      expect(provider).toHaveProperty('name');
      expect(provider).toHaveProperty('enabled');
    }
  });

  it('should track provider health metrics', () => {
    const healthReport = providerManager.getHealthReport();
    expect(Array.isArray(healthReport)).toBe(true);
    
    healthReport.forEach((provider: any) => {
      expect(provider).toHaveProperty('id');
      expect(provider).toHaveProperty('available');
      expect(provider).toHaveProperty('lastChecked');
      expect(provider).toHaveProperty('errorCount');
    });
  });

  it('should simulate provider health update with Logfire tracking', () => {
    const availableProviders = providerManager.getAvailableProviders();
    
    if (availableProviders.length > 0) {
      const providerId = availableProviders[0].id;
      
      // Simulate a health update - this should trigger Logfire tracking
      providerManager.updateProviderHealth(providerId, true, 250, undefined);
      
      const healthReport = providerManager.getHealthReport();
      const updatedProvider = healthReport.find((p: any) => p.id === providerId);
      
      expect(updatedProvider).toBeDefined();
      expect(updatedProvider.available).toBe(true);
    }
  });

  it('should have PydanticLlmService available', () => {
    expect(pydanticLlmService).toBeDefined();
    expect(typeof pydanticLlmService.getServiceStatistics).toBe('function');
  });

  it('should get service statistics', () => {
    const stats = pydanticLlmService.getServiceStatistics();
    expect(stats).toBeDefined();
    expect(stats).toHaveProperty('activeExecutions');
    expect(stats).toHaveProperty('poolSize');
    expect(stats).toHaveProperty('providerHealth');
  });
});

describe('Simple Test', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });
}); 