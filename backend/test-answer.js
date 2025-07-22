#!/usr/bin/env node

// Set up environment for AWS secrets
process.env.NODE_ENV = 'development';
process.env.SECRETS_PROVIDER = 'aws';
process.env.DATABASE_SECRET_NAME = 'serplexity-db';
process.env.AWS_ACCESS_KEY_ID = 'AKIAVFIWIQECD5NKMCUX';
process.env.AWS_SECRET_ACCESS_KEY = '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';
process.env.AWS_REGION = 'us-east-2';

// Also set OpenAI key for testing
process.env.OPENAI_API_KEY = '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';

const { pydanticLlmService } = require('./dist/services/pydanticLlmService');

(async () => {
  try {
    console.log('🔍 Testing answer agent...');
    
    const testInput = {
      question: "What are the main competitors in the smartphone market?",
      company_name: "TestCorp",
      competitors: ["Apple", "Samsung"]
    };
    
    console.log('📥 Test input:', JSON.stringify(testInput, null, 2));
    
    const result = await pydanticLlmService.executeAgent(
      "answer_agent.py",
      testInput,
      null,
      { timeout: 60000, modelId: "openai:gpt-4o-mini" }
    );
    
    console.log('📤 Result success:', result.metadata?.success);
    console.log('📤 Answer preview:', result.data?.answer?.substring(0, 500) + '...');
    
    // Check for brand tags
    const brandMatches = (result.data?.answer || '').match(/<brand>(.*?)<\/brand>/gi);
    console.log(`🏷️  Brand tags found: ${brandMatches?.length || 0}`);
    if (brandMatches && brandMatches.length > 0) {
      console.log('🏷️  Tagged brands:', brandMatches.slice(0, 5).join(', '));
    }
    
    console.log('✅ Answer agent test completed');
  } catch (error) {
    console.error('❌ Answer agent test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
})();