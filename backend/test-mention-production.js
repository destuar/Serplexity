#!/usr/bin/env node

// Test mention agent with real API keys from AWS secrets
process.env.NODE_ENV = 'development';
process.env.SECRETS_PROVIDER = 'aws';
process.env.DATABASE_SECRET_NAME = 'serplexity-db';
process.env.AWS_ACCESS_KEY_ID = 'AKIAVFIWIQECD5NKMCUX';
process.env.AWS_SECRET_ACCESS_KEY = '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';
process.env.AWS_REGION = 'us-east-2';

const { pydanticLlmService } = require('./dist/services/pydanticLlmService');

(async () => {
  try {
    console.log('🚀 10X ENGINEER MODE: MENTION AGENT PRODUCTION TEST');
    console.log('=' .repeat(60));
    
    const testInput = {
      text: `For advanced surgical procedures, patients often seek specialized care at top medical institutions. Mayo Clinic offers comprehensive cardiac surgery programs, while Johns Hopkins Hospital provides cutting-edge neurosurgery services. Many patients also consider Cleveland Clinic for their specialized orthopedic treatments.

Remote consultations have become more accessible through telemedicine platforms. Virtual healthcare services are now available through companies like Teladoc and Amwell. These platforms seek to provide quality care while maintaining patient privacy.

In the technology sector, Apple continues to innovate with the iPhone, while Microsoft enhances productivity through Office 365. Google's search capabilities and Amazon's cloud services (AWS) dominate their respective markets. Tesla's electric vehicles represent the future of sustainable transportation.

Patients should access comprehensive information about their treatment options. They need to find providers who offer modern, innovative solutions for their healthcare needs.`,
      company_name: "Mayo Clinic",
      competitors: ["Johns Hopkins Hospital", "Cleveland Clinic", "Cedars-Sinai"]
    };
    
    console.log('📥 Input Text Preview:');
    console.log(`"${testInput.text.substring(0, 200)}..."`);
    console.log(`📋 Company: ${testInput.company_name}`);
    console.log(`🏥 Competitors: ${testInput.competitors.join(', ')}`);
    
    const result = await pydanticLlmService.executeAgent(
      "mention_agent.py",
      testInput,
      null,
      { modelId: "openai:gpt-4.1-mini", timeout: 60000 }
    );
    
    console.log('\n📊 EXECUTION RESULTS:');
    console.log(`✅ Success: ${result.metadata?.success}`);
    console.log(`🤖 Model: ${result.metadata?.modelUsed}`);
    console.log(`⏱️  Time: ${result.metadata?.executionTime}ms`);
    console.log(`💳 Tokens: ${result.metadata?.tokensUsed}`);
    
    if (result.data?.mentions) {
      const mentions = result.data.mentions;
      const brands = mentions.filter(m => m.type === 'brand');
      const products = mentions.filter(m => m.type === 'product');
      
      console.log('\n🎯 INTELLIGENT DETECTION RESULTS:');
      console.log(`📊 Total mentions: ${mentions.length}`);
      console.log(`🏢 Brands: ${brands.length}`);
      console.log(`📦 Products: ${products.length}`);
      
      if (brands.length > 0) {
        console.log('\n🏢 DETECTED BRANDS:');
        brands
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 10)
          .forEach((brand, i) => {
            console.log(`  ${i+1}. ${brand.name} (${(brand.confidence * 100).toFixed(0)}%) - ${brand.category || 'Unknown'}`);
            console.log(`     Context: "${brand.context}"`);
          });
      }
      
      if (products.length > 0) {
        console.log('\n📦 DETECTED PRODUCTS:');
        products
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 5)
          .forEach((product, i) => {
            console.log(`  ${i+1}. ${product.name} (${(product.confidence * 100).toFixed(0)}%) - ${product.category || 'Unknown'}`);
            console.log(`     Context: "${product.context}"`);
          });
      }
      
      // QUALITY ANALYSIS
      console.log('\n🔍 QUALITY ANALYSIS:');
      const expectedBrands = ['Mayo Clinic', 'Johns Hopkins Hospital', 'Cleveland Clinic', 'Apple', 'Microsoft', 'Google', 'Amazon', 'Tesla', 'Teladoc', 'Amwell'];
      const expectedProducts = ['iPhone', 'Office 365', 'AWS'];
      const genericWords = ['advanced', 'specialized', 'comprehensive', 'remote', 'virtual', 'accessible', 'quality', 'modern', 'innovative', 'seek', 'find', 'provide', 'offers', 'available', 'cutting-edge'];
      
      const detectedNames = mentions.map(m => m.name.toLowerCase());
      const correctBrands = expectedBrands.filter(brand => 
        detectedNames.some(detected => detected.includes(brand.toLowerCase()) || brand.toLowerCase().includes(detected))
      );
      const incorrectGeneric = genericWords.filter(word => 
        detectedNames.some(detected => detected === word.toLowerCase())
      );
      
      console.log(`✅ Correctly identified: ${correctBrands.join(', ') || 'None'}`);
      console.log(`❌ Incorrectly tagged generic words: ${incorrectGeneric.join(', ') || 'None'}`);
      
      const precision = correctBrands.length / Math.max(mentions.length, 1) * 100;
      const recall = correctBrands.length / expectedBrands.length * 100;
      const f1Score = (2 * precision * recall) / Math.max(precision + recall, 1);
      
      console.log(`📈 Precision: ${precision.toFixed(1)}% (correct / total detected)`);
      console.log(`📈 Recall: ${recall.toFixed(1)}% (correct / expected total)`);
      console.log(`📈 F1 Score: ${f1Score.toFixed(1)}%`);
      
      if (incorrectGeneric.length === 0) {
        console.log('🎯 PERFECT! No generic words incorrectly tagged as brands.');
      } else {
        console.log(`⚠️  ${incorrectGeneric.length} generic words incorrectly tagged.`);
      }
      
    } else if (result.data?.error) {
      console.log(`\n❌ Agent Error: ${result.data.error}`);
    } else {
      console.log('\nℹ️  No mentions detected (could be correct if text has no brands)');
    }
    
    console.log('\n🏁 MENTION AGENT TEST COMPLETED');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
})();