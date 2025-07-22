#!/usr/bin/env node

// Set up environment for AWS secrets and API keys
process.env.NODE_ENV = 'development';
process.env.SECRETS_PROVIDER = 'aws';
process.env.DATABASE_SECRET_NAME = 'serplexity-db';
process.env.AWS_ACCESS_KEY_ID = 'AKIAVFIWIQECD5NKMCUX';
process.env.AWS_SECRET_ACCESS_KEY = '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';
process.env.AWS_REGION = 'us-east-2';

// Set API keys for testing
process.env.OPENAI_API_KEY = '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';

const { pydanticLlmService } = require('./dist/services/pydanticLlmService');

(async () => {
  try {
    console.log('🔍 Testing answer agent with real question...');
    
    // Use the same input format as the reportWorker
    const questionInput = {
      question: "Which hospitals offer comprehensive weight loss programs including both surgical and non-surgical options?",
      company_name: "Cedars-Sinai",
      enable_web_search: true
    };
    
    console.log('📥 Test input:', JSON.stringify(questionInput, null, 2));
    
    const result = await pydanticLlmService.executeAgent(
      "answer_agent.py",
      questionInput,
      null,
      { modelId: "openai:gpt-4o-mini", timeout: 60000 }
    );
    
    console.log('📤 Result success:', result.metadata?.success);
    console.log('📤 Model used:', result.metadata?.modelUsed);
    console.log('📤 Execution time:', result.metadata?.executionTime);
    
    if (result.data?.answer) {
      const answer = result.data.answer;
      console.log(`📝 Answer length: ${answer.length} chars`);
      
      // Check for brand tags
      const brandMatches = answer.match(/<brand>(.*?)<\/brand>/gi);
      console.log(`🏷️  Brand tags found: ${brandMatches?.length || 0}`);
      
      if (brandMatches && brandMatches.length > 0) {
        console.log('🏷️  Tagged brands:', brandMatches.slice(0, 10).join(', '));
      }
      
      // Look for untagged companies
      const companyPatterns = ['Mayo', 'Cleveland', 'Johns Hopkins', 'Emory', 'Village Hospital', 'Meta', 'Apple', 'Microsoft'];
      const foundCompanies = companyPatterns.filter(company => 
        answer.toLowerCase().includes(company.toLowerCase())
      );
      
      if (foundCompanies.length > 0) {
        console.log(`🔍 Untagged companies detected: ${foundCompanies.join(', ')}`);
      }
      
      // Show preview of answer
      console.log('\n📄 Answer preview:');
      console.log(`"${answer.substring(0, 800)}..."`);
      
    } else {
      console.log('❌ No answer in result');
      console.log('Raw result:', JSON.stringify(result, null, 2));
    }
    
    console.log('✅ Answer agent test completed');
  } catch (error) {
    console.error('❌ Answer agent test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
})();