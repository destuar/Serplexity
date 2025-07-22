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
    console.log('🔍 Testing mention agent...');
    
    const testInput = {
      text: "We compared Apple iPhone with Samsung Galaxy and Microsoft Surface. Google Chrome is also popular with Amazon Web Services being used by Tesla for their infrastructure.",
      company_name: "TestCorp",
      competitors: ["Apple", "Microsoft"]
    };
    
    console.log('📥 Test input:', JSON.stringify(testInput, null, 2));
    
    const result = await pydanticLlmService.executeAgent(
      "mention_agent.py",
      testInput,
      null,
      { timeout: 30000 }
    );
    
    console.log('📤 Result:', JSON.stringify(result, null, 2));
    
    if (result.data && result.data.mentions) {
      console.log('\n🎯 Detected Mentions:');
      result.data.mentions.forEach((mention, i) => {
        console.log(`  ${i+1}. ${mention.name} (${mention.type}) - confidence: ${mention.confidence}`);
      });
    }
    
    console.log('✅ Mention agent test completed');
  } catch (error) {
    console.error('❌ Mention agent test failed:', error.message);
    process.exit(1);
  }
})();