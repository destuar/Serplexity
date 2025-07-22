#!/usr/bin/env node

process.env.NODE_ENV = 'development';
process.env.SECRETS_PROVIDER = 'aws';
process.env.DATABASE_SECRET_NAME = 'serplexity-db';
process.env.AWS_ACCESS_KEY_ID = 'AKIAVFIWIQECD5NKMCUX';
process.env.AWS_SECRET_ACCESS_KEY = '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';
process.env.AWS_REGION = 'us-east-2';

const { pydanticLlmService } = require('./dist/services/pydanticLlmService');

async function testMentionTaggingPipeline() {
  console.log('🔗 MENTION DETECTION + TAGGING PIPELINE TEST');
  console.log('=' .repeat(70));
  
  // Use the same text that had a tagging problem in the answer agent test
  const testText = `Nordstrom faces competition from a diverse array of fashion retailers, including:

- **Macy's**: A major department store offering a mix of affordable and luxury brands
- **Dillard's**: Operating 247 stores, Dillard's provides upscale yet affordable fashion  
- **Neiman Marcus**: A luxury retailer specializing in exclusive and emerging brands
- **Saks Fifth Avenue**: A luxury department store chain with over 12,000 employees
- **H&M**: A global fashion retailer offering a wide range of stylish clothing
- **Zara**: A fast-fashion retailer known for its trendy clothing and accessories

These retailers contribute to the competitive landscape that Nordstrom navigates.`;
  
  try {
    console.log('🔍 Step 1: Running mention detection...');
    
    const mentionResult = await pydanticLlmService.executeAgent(
      "mention_agent.py",
      {
        text: testText,
        company_name: "Nordstrom",
        competitors: ["Macy's", "Saks Fifth Avenue"]
      },
      null,
      { modelId: "openai:gpt-4o-mini", timeout: 60000 }
    );

    if (!mentionResult.data?.mentions) {
      console.log('❌ Step 1 failed - no mentions returned');
      return;
    }

    console.log(`✅ Step 1 complete - ${mentionResult.data.mentions.length} mentions detected`);
    
    // Show detected mentions
    console.log('\n📋 Detected mentions:');
    mentionResult.data.mentions.forEach((mention, i) => {
      console.log(`  ${i+1}. "${mention.name}" at position ${mention.position} (conf: ${mention.confidence})`);
    });
    
    console.log('\n🏷️  Step 2: Simulating tag_brands_in_text function...');
    
    // Simulate the tagging logic
    const mentions = mentionResult.data.mentions;
    let taggedText = testText;
    const sortedMentions = [...mentions].sort((a, b) => b.position - a.position); // Reverse position order
    
    console.log(`🔄 Processing ${sortedMentions.length} mentions in reverse position order...`);
    
    let successfulTags = 0;
    let failedTags = 0;
    
    for (const mention of sortedMentions) {
      if (mention.confidence >= 0.5) {
        const startPos = mention.position;
        const endPos = startPos + mention.name.length;
        
        console.log(`\n  🔍 Processing: "${mention.name}" at ${startPos}-${endPos}`);
        
        // Check if position is valid
        if (startPos < taggedText.length && endPos <= taggedText.length) {
          const extractedText = taggedText.substring(startPos, endPos);
          console.log(`    📝 Text at position: "${extractedText}"`);
          console.log(`    🎯 Expected: "${mention.name}"`);
          console.log(`    ✅ Match: ${extractedText.toLowerCase() === mention.name.toLowerCase()}`);
          
          if (extractedText.toLowerCase() === mention.name.toLowerCase()) {
            // Apply the tag
            taggedText = taggedText.substring(0, startPos) + 
                        `<brand>${extractedText}</brand>` + 
                        taggedText.substring(endPos);
            successfulTags++;
            console.log(`    ✅ Tagged successfully`);
          } else {
            failedTags++;
            console.log(`    ❌ Text mismatch - skipping tag`);
          }
        } else {
          failedTags++;
          console.log(`    ❌ Invalid position bounds - skipping tag`);
        }
      }
    }
    
    console.log(`\n📊 Tagging Results:`);
    console.log(`  ✅ Successful tags: ${successfulTags}`);
    console.log(`  ❌ Failed tags: ${failedTags}`);
    
    // Count final brand tags
    const finalBrandTags = (taggedText.match(/<brand>/g) || []).length;
    console.log(`  🏷️  Final <brand> tags: ${finalBrandTags}`);
    
    console.log('\n📄 Tagged text preview:');
    console.log('─'.repeat(50));
    console.log(taggedText.substring(0, 500) + (taggedText.length > 500 ? '...' : ''));
    console.log('─'.repeat(50));
    
    // Final analysis
    console.log('\n🔍 PIPELINE ANALYSIS:');
    if (finalBrandTags === mentionResult.data.mentions.length) {
      console.log('✅ SUCCESS: All mentions were successfully tagged');
    } else if (finalBrandTags > 0) {
      console.log(`⚠️  PARTIAL: ${finalBrandTags}/${mentionResult.data.mentions.length} mentions tagged`);
      console.log('   → Position mismatches or text changes during processing');
    } else {
      console.log('❌ FAILURE: No mentions were tagged');
      console.log('   → Systematic issue with position tracking or text matching');
    }

  } catch (error) {
    console.error('❌ Pipeline test failed:', error.message);
    console.error('📍 Stack trace:', error.stack.split('\n').slice(0, 5).join('\n'));
  }
}

testMentionTaggingPipeline();