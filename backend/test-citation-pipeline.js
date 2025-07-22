#!/usr/bin/env node

// Test complete citation pipeline - answer agent + citation parsing
process.env.NODE_ENV = 'development';
process.env.SECRETS_PROVIDER = 'aws';
process.env.DATABASE_SECRET_NAME = 'serplexity-db';
process.env.AWS_ACCESS_KEY_ID = 'AKIAVFIWIQECD5NKMCUX';
process.env.AWS_SECRET_ACCESS_KEY = '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';
process.env.AWS_REGION = 'us-east-2';

const { pydanticLlmService } = require('./dist/services/pydanticLlmService');

async function testAnswerAgentCitations() {
  console.log('🔗 CITATION PIPELINE TEST');
  console.log('=' .repeat(80));
  console.log('Testing answer agent with web search and citation extraction...\n');

  // Test cases that should require web search and return citations
  const testQuestions = [
    {
      question: "What are the latest treatments for diabetes approved by the FDA in 2024?",
      company: "Mayo Clinic",
      competitors: ["Cleveland Clinic", "Johns Hopkins"],
      description: "Medical query requiring recent information"
    },
    {
      question: "How does Microsoft Azure compare to AWS for machine learning capabilities?",
      company: "Microsoft", 
      competitors: ["Amazon", "Google"],
      description: "Technical comparison requiring current data"
    },
    {
      question: "What are the current market trends in electric vehicle adoption?",
      company: "Tesla",
      competitors: ["Ford", "GM", "Rivian"],
      description: "Market analysis requiring recent statistics"
    }
  ];

  for (let i = 0; i < testQuestions.length; i++) {
    const test = testQuestions[i];
    console.log(`📝 Test ${i + 1}: ${test.description}`);
    console.log(`❓ Question: "${test.question}"`);
    console.log(`🏢 Company: ${test.company}`);
    console.log('-'.repeat(70));

    try {
      console.log('🚀 Calling answer agent with web search enabled...');
      
      const result = await pydanticLlmService.executeAgent(
        "answer_agent.py",
        {
          question: test.question,
          company_name: test.company,
          competitors: test.competitors,
          use_web_search: true,
          max_tokens: 1500
        },
        null,
        { modelId: "openai:gpt-4o-mini", timeout: 120000 }
      );

      console.log('📊 Answer Agent Results:');
      console.log(`✅ Success: ${result.metadata?.success}`);
      console.log(`🤖 Model: ${result.metadata?.modelUsed}`);
      console.log(`⏱️  Time: ${result.metadata?.executionTime}ms`);
      console.log(`💳 Tokens: ${result.metadata?.tokensUsed}`);

      if (result.data) {
        console.log('\n📄 ANSWER CONTENT ANALYSIS:');
        
        // Check if we have an answer
        const answer = result.data.answer || result.data.response || result.data.result;
        if (answer) {
          console.log(`📝 Answer length: ${answer.length} characters`);
          console.log(`📝 Answer preview: "${answer.substring(0, 200)}..."`);
          
          // Analyze for citation patterns
          console.log('\n🔍 CITATION ANALYSIS:');
          
          // Check for markdown citations [title](url)
          const markdownCitations = answer.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
          console.log(`🔗 Markdown citations found: ${markdownCitations.length}`);
          if (markdownCitations.length > 0) {
            console.log('   Examples:');
            markdownCitations.slice(0, 3).forEach((citation, idx) => {
              console.log(`   ${idx + 1}. ${citation}`);
            });
          }
          
          // Check for natural URLs
          const urlPattern = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&=]*)/g;
          const naturalUrls = answer.match(urlPattern) || [];
          console.log(`🌐 Natural URLs found: ${naturalUrls.length}`);
          if (naturalUrls.length > 0) {
            console.log('   Examples:');
            naturalUrls.slice(0, 3).forEach((url, idx) => {
              console.log(`   ${idx + 1}. ${url}`);
            });
          }
          
          // Check for web search indicators
          const webSearchIndicators = [
            'according to recent research',
            'recent studies show',
            'based on current data',
            'latest information',
            'recent findings',
            'current trends',
            'as of 2024',
            'recent reports'
          ];
          
          const foundIndicators = webSearchIndicators.filter(indicator => 
            answer.toLowerCase().includes(indicator.toLowerCase())
          );
          
          console.log(`🔍 Web search indicators: ${foundIndicators.length}`);
          if (foundIndicators.length > 0) {
            console.log(`   Found: ${foundIndicators.join(', ')}`);
          }
          
          // Check if this looks like it used web search
          const hasWebSearchContent = markdownCitations.length > 0 || 
                                     naturalUrls.length > 0 || 
                                     foundIndicators.length > 0;
          
          console.log(`\n📡 Web search usage: ${hasWebSearchContent ? '✅ Likely used' : '❌ Possibly not used'}`);
          
          // Test citation extraction logic (simulate what reportWorker does)
          console.log('\n🔧 CITATION EXTRACTION TEST:');
          
          const citations = new Set();
          let citationCount = 0;

          // Extract markdown citations
          const markdownRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
          let markdownMatch;
          while ((markdownMatch = markdownRegex.exec(answer)) !== null) {
            const title = markdownMatch[1];
            const url = markdownMatch[2];
            citations.add(JSON.stringify({ url, title, source: 'markdown' }));
            citationCount++;
          }

          // Extract natural URLs
          const urlMatches = answer.match(urlPattern) || [];
          for (const url of urlMatches) {
            try {
              const urlObj = new URL(url);
              const domain = urlObj.hostname.replace('www.', '');
              const title = `${domain.charAt(0).toUpperCase() + domain.slice(1)} - Web Result`;
              citations.add(JSON.stringify({ url, title, source: 'natural' }));
              citationCount++;
            } catch (error) {
              console.log(`   ⚠️ Invalid URL: ${url}`);
            }
          }
          
          console.log(`📊 Extractable citations: ${citations.size} unique citations`);
          
          if (citations.size > 0) {
            console.log('   Citations that would be saved:');
            Array.from(citations).slice(0, 5).forEach((citationStr, idx) => {
              const citation = JSON.parse(citationStr);
              console.log(`   ${idx + 1}. [${citation.source}] ${citation.title}: ${citation.url}`);
            });
          }
          
        } else {
          console.log('❌ No answer content found');
        }
        
        // Check for other data fields
        console.log('\n📋 RESPONSE STRUCTURE:');
        console.log('Available fields:', Object.keys(result.data));
        
      } else if (result.error) {
        console.log(`❌ Agent Error: ${result.error}`);
      } else {
        console.log('❌ No data returned from answer agent');
      }

    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
      if (error.stack) {
        console.log(`📍 Stack trace: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
      }
    }

    console.log('\n');
  }
  
  console.log('🏁 CITATION PIPELINE TEST COMPLETED');
}

// Run the test
testAnswerAgentCitations().catch(error => {
  console.error('❌ Citation pipeline test failed:', error.message);
  process.exit(1);
});