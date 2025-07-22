#!/usr/bin/env node

process.env.NODE_ENV = 'development';
process.env.SECRETS_PROVIDER = 'aws';
process.env.DATABASE_SECRET_NAME = 'serplexity-db';
process.env.AWS_ACCESS_KEY_ID = 'AKIAVFIWIQECD5NKMCUX';
process.env.AWS_SECRET_ACCESS_KEY = '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';
process.env.AWS_REGION = 'us-east-2';

const { pydanticLlmService } = require('./dist/services/pydanticLlmService');

async function testMentionAgentDirect() {
  console.log('🔍 DIRECT MENTION AGENT TEST');
  console.log('=' .repeat(60));
  
  const testText = `Nordstrom faces competition from Macy's, Dillard's, Kohl's, Neiman Marcus, Saks Fifth Avenue, TJ Maxx, Ross Stores, Burlington, H&M, Zara, ASOS, J.Crew, and Anthropologie. These retailers contribute to the competitive landscape.`;
  
  try {
    console.log('📝 Testing mention agent with competitor-rich text...');
    console.log(`🎯 Text: "${testText}"`);
    
    const result = await pydanticLlmService.executeAgent(
      "mention_agent.py",
      {
        text: testText,
        company_name: "Nordstrom",
        competitors: ["Macy's", "Saks Fifth Avenue"] // Known competitors
      },
      null,
      { modelId: "openai:gpt-4o-mini", timeout: 60000 }
    );

    if (!result.data) {
      console.log('❌ No data returned from mention agent');
      console.log('Result:', JSON.stringify(result, null, 2));
      return;
    }

    console.log('✅ Mention agent completed successfully');
    console.log('📊 Result structure:', Object.keys(result.data));
    
    if (result.data.mentions) {
      console.log(`🏷️  Mentions found: ${result.data.mentions.length}`);
      
      console.log('\n🔍 Detected mentions:');
      result.data.mentions.forEach((mention, i) => {
        console.log(`  ${i+1}. "${mention.name}" (confidence: ${mention.confidence})`);
        console.log(`     Type: ${mention.type}, Position: ${mention.position}`);
        console.log(`     Context: ${mention.context ? mention.context.substring(0, 60) + '...' : 'N/A'}`);
      });
      
      // Check if major competitors were detected
      const detectedBrands = result.data.mentions.map(m => m.name ? m.name.toLowerCase() : 'undefined');
      const expectedCompetitors = ['macy\'s', 'saks fifth avenue', 'neiman marcus', 'h&m', 'zara'];
      
      console.log('\n📋 Detection analysis:');
      expectedCompetitors.forEach(competitor => {
        const detected = detectedBrands.some(brand => 
          brand.includes(competitor) || competitor.includes(brand)
        );
        console.log(`  ${detected ? '✅' : '❌'} ${competitor}: ${detected ? 'DETECTED' : 'MISSED'}`);
      });
      
    } else {
      console.log('❌ No mentions array in result');
      console.log('Full result:', JSON.stringify(result.data, null, 2));
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('📍 Stack trace:', error.stack.split('\n').slice(0, 8).join('\n'));
    }
  }
}

testMentionAgentDirect();