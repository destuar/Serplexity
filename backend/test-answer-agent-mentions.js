#!/usr/bin/env node

process.env.NODE_ENV = 'development';
process.env.SECRETS_PROVIDER = 'aws';
process.env.DATABASE_SECRET_NAME = 'serplexity-db';
process.env.AWS_ACCESS_KEY_ID = 'AKIAVFIWIQECD5NKMCUX';
process.env.AWS_SECRET_ACCESS_KEY = '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';
process.env.AWS_REGION = 'us-east-2';

const { pydanticLlmService } = require('./dist/services/pydanticLlmService');

async function testAnswerAgentMentions() {
  console.log('🧪 ANSWER AGENT MENTION TAGGING TEST');
  console.log('=' .repeat(60));
  
  try {
    console.log('📝 Testing answer agent with a simple question about fashion retailers...');
    
    const result = await pydanticLlmService.executeAgent(
      "answer_agent.py",
      {
        question: "Which fashion retailers compete with Nordstrom?",
        company_name: "Nordstrom",
        competitors: ["Macy's", "Saks Fifth Avenue"],
        use_web_search: false, // Disable web search for faster testing
        max_tokens: 800
      },
      null,
      { modelId: "openai:gpt-4o-mini", timeout: 60000 }
    );

    if (!result.data?.answer) {
      console.log('❌ No answer returned from answer agent');
      console.log('Result:', JSON.stringify(result, null, 2));
      return;
    }

    const answer = result.data.answer;
    console.log('✅ Answer agent completed successfully');
    console.log(`📏 Answer length: ${answer.length} characters`);
    console.log(`🏷️  Brand mentions count: ${result.data.brand_mentions_count || 0}`);
    
    // Check for brand tags
    const brandTagCount = (answer.match(/<brand>/g) || []).length;
    console.log(`🔖 <brand> tags found: ${brandTagCount}`);
    
    // Show the answer
    console.log('\n📄 Answer content:');
    console.log('─'.repeat(50));
    console.log(answer);
    console.log('─'.repeat(50));
    
    // Extract brand mentions
    if (brandTagCount > 0) {
      console.log('\n🏢 Detected brand mentions:');
      const brandRegex = /<brand>([^<]+)<\/brand>/g;
      let match;
      let i = 1;
      while ((match = brandRegex.exec(answer)) !== null) {
        console.log(`  ${i}. "${match[1].trim()}"`);
        i++;
      }
    } else {
      console.log('\n⚠️  No <brand> tags found in answer');
      console.log('This indicates the mention agent is not detecting/tagging brands');
    }
    
    // Analysis
    console.log('\n🔍 ANALYSIS:');
    if (brandTagCount > 0) {
      console.log('✅ Answer agent is successfully tagging brands');
      console.log('   → The issue must be in the reportWorker mention extraction');
    } else {
      console.log('❌ Answer agent is NOT tagging brands');
      console.log('   → The mention agent may have authentication issues');
      console.log('   → Or mention detection is failing');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('📍 Stack trace:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }
}

testAnswerAgentMentions();