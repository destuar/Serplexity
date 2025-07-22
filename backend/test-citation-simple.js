#!/usr/bin/env node

// Simple test to verify citation extraction from answer agent responses
process.env.NODE_ENV = 'development';
process.env.SECRETS_PROVIDER = 'aws';
process.env.DATABASE_SECRET_NAME = 'serplexity-db';
process.env.AWS_ACCESS_KEY_ID = 'AKIAVFIWIQECD5NKMCUX';
process.env.AWS_SECRET_ACCESS_KEY = '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';
process.env.AWS_REGION = 'us-east-2';

const { pydanticLlmService } = require('./dist/services/pydanticLlmService');

async function testCitationExtraction() {
  console.log('🔍 CITATION EXTRACTION TEST');
  console.log('=' .repeat(60));
  console.log('Testing citation extraction from answer agent responses...\n');

  // Use a query that definitely needs web search - current events
  const testQuery = {
    question: "What are the latest FDA drug approvals in December 2024 and January 2025?",
    company_name: "Pfizer",
    competitors: ["Moderna", "Johnson & Johnson"],
    use_web_search: true,
    max_tokens: 1500
  };

  try {
    console.log('📝 Testing with current events query that requires web search...');
    console.log(`❓ Question: "${testQuery.question}"`);
    console.log(`🏢 Company: ${testQuery.company_name}`);
    console.log('-'.repeat(50));

    const result = await pydanticLlmService.executeAgent(
      "answer_agent.py",
      testQuery,
      null,
      { modelId: "openai:gpt-4o-mini", timeout: 120000 }
    );

    console.log('📊 Answer Agent Results:');
    console.log(`✅ Success: ${result.metadata?.success}`);
    console.log(`🤖 Model: ${result.metadata?.modelUsed}`);
    console.log(`⏱️  Execution Time: ${result.metadata?.executionTime}ms`);
    console.log(`💳 Tokens Used: ${result.metadata?.tokensUsed}`);

    if (!result.data) {
      console.log('❌ No data returned from answer agent');
      return;
    }

    console.log('\n📋 Response Structure:');
    console.log('Available fields:', Object.keys(result.data));

    const answer = result.data.answer || result.data.response;
    if (!answer) {
      console.log('❌ No answer content found in response');
      return;
    }

    console.log('\n📄 Answer Analysis:');
    console.log(`📝 Length: ${answer.length} characters`);
    console.log(`📝 Preview: "${answer.substring(0, 200)}..."`);

    // Check web search flag
    if (result.data.has_web_search !== undefined) {
      console.log(`📡 Web Search Used: ${result.data.has_web_search ? '✅ Yes' : '❌ No'}`);
    }

    // Check if citations are already provided by the agent
    if (result.data.citations) {
      console.log(`🔗 Citations provided by agent: ${Array.isArray(result.data.citations) ? result.data.citations.length : 'Not an array'}`);
    }

    // Extract citations using reportWorker logic
    console.log('\n🔧 Citation Extraction Test:');
    
    const citations = new Set();
    let totalFound = 0;

    // 1. Extract markdown citations [title](url)
    const markdownRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let markdownMatch;
    let markdownCount = 0;
    while ((markdownMatch = markdownRegex.exec(answer)) !== null) {
      const title = markdownMatch[1];
      const url = markdownMatch[2];
      citations.add(JSON.stringify({ url, title, source: 'markdown' }));
      markdownCount++;
    }
    console.log(`🔗 Markdown citations found: ${markdownCount}`);

    // 2. Extract natural URLs
    const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&=]*)/g;
    const urlMatches = answer.match(urlRegex) || [];
    console.log(`🌐 Natural URLs found: ${urlMatches.length}`);
    
    for (const url of urlMatches) {
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace('www.', '');
        const title = `${domain.charAt(0).toUpperCase() + domain.slice(1)} - Web Result`;
        citations.add(JSON.stringify({ url, title, source: 'natural' }));
      } catch (error) {
        console.log(`   ⚠️  Skipped invalid URL: ${url}`);
      }
    }

    const uniqueCitations = Array.from(citations).map(c => JSON.parse(c));
    totalFound = uniqueCitations.length;

    console.log(`\n📊 Citation Summary:`);
    console.log(`   • Total unique citations extractable: ${totalFound}`);
    console.log(`   • Markdown format: ${markdownCount}`);
    console.log(`   • Natural URLs: ${urlMatches.length}`);
    console.log(`   • Unique after dedup: ${uniqueCitations.length}`);

    if (uniqueCitations.length > 0) {
      console.log('\n📋 Citations that would be saved to database:');
      uniqueCitations.slice(0, 8).forEach((citation, idx) => {
        console.log(`   ${idx + 1}. [${citation.source}] ${citation.title}`);
        console.log(`      URL: ${citation.url.substring(0, 80)}${citation.url.length > 80 ? '...' : ''}`);
      });
      
      if (uniqueCitations.length > 8) {
        console.log(`   ... and ${uniqueCitations.length - 8} more citations`);
      }
    }

    // Check for web search indicators
    const webSearchIndicators = [
      'according to', 'recent', 'latest', 'current', 'as of 2024', 'as of 2025',
      'recently approved', 'FDA announced', 'new approval'
    ];
    
    const foundIndicators = webSearchIndicators.filter(indicator => 
      answer.toLowerCase().includes(indicator.toLowerCase())
    );
    
    if (foundIndicators.length > 0) {
      console.log(`\n🔍 Web search indicators found: ${foundIndicators.join(', ')}`);
    }

    // Overall assessment
    console.log('\n🎯 ASSESSMENT:');
    if (totalFound > 0) {
      console.log('✅ SUCCESS: Citations are being returned and can be extracted');
      console.log(`   → ${totalFound} citations would be saved to database`);
    } else {
      console.log('⚠️  No citations found - checking if web search was actually used...');
      
      if (result.data.has_web_search === false) {
        console.log('   → Web search was not used by the agent');
      } else if (foundIndicators.length > 0) {
        console.log('   → Content suggests web search was used, but no URLs in response');
      } else {
        console.log('   → May be using cached/knowledge-based response');
      }
    }

  } catch (error) {
    console.error('❌ Citation extraction test failed:', error.message);
  }

  console.log('\n🏁 CITATION EXTRACTION TEST COMPLETED');
}

// Run the test
testCitationExtraction().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});