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
      text: `For advanced surgical procedures, patients often seek specialized care at top medical institutions. Mayo Clinic offers comprehensive cardiac surgery programs, while Johns Hopkins Hospital provides cutting-edge neurosurgery services. Many patients also consider Cleveland Clinic for their specialized orthopedic treatments.

Remote consultations have become more accessible through telemedicine platforms. Virtual healthcare services are now available through companies like Teladoc and Amwell. These platforms seek to provide quality care while maintaining patient privacy.

In the technology sector, Apple continues to innovate with the iPhone, while Microsoft enhances productivity through Office 365. Google's search capabilities and Amazon's cloud services (AWS) dominate their respective markets. Tesla's electric vehicles represent the future of sustainable transportation.

Patients should access comprehensive information about their treatment options. They need to find providers who offer modern, innovative solutions for their healthcare needs.`,
      company_name: "Mayo Clinic",
      competitors: ["Johns Hopkins Hospital", "Cleveland Clinic", "Cedars-Sinai"]
    };
    
    console.log('📥 Test input:', JSON.stringify(testInput, null, 2));
    
    const result = await pydanticLlmService.executeAgent(
      "mention_agent.py",
      testInput,
      null,
      { modelId: "openai:gpt-4.1-mini", timeout: 30000 }
    );
    
    console.log('📤 Result:', JSON.stringify(result, null, 2));
    
    if (result.data && result.data.mentions) {
      console.log('\n🎯 Detected Mentions:');
      const brands = result.data.mentions.filter(m => m.type === 'brand');
      const products = result.data.mentions.filter(m => m.type === 'product');
      
      console.log(`\n🏢 BRANDS (${brands.length}):`);
      brands.forEach((mention, i) => {
        console.log(`  ${i+1}. ${mention.name} (confidence: ${mention.confidence}) - ${mention.category || 'N/A'}`);
        console.log(`     Context: "${mention.context}"`);
      });
      
      console.log(`\n📦 PRODUCTS (${products.length}):`);
      products.forEach((mention, i) => {
        console.log(`  ${i+1}. ${mention.name} (confidence: ${mention.confidence}) - ${mention.category || 'N/A'}`);
        console.log(`     Context: "${mention.context}"`);
      });
      
      // Analysis
      console.log('\n🔍 ANALYSIS:');
      console.log('='.repeat(50));
      
      const expectedBrands = ['Mayo Clinic', 'Johns Hopkins Hospital', 'Cleveland Clinic', 'Apple', 'Microsoft', 'Google', 'Amazon', 'Tesla', 'Teladoc', 'Amwell'];
      const expectedProducts = ['iPhone', 'Office 365', 'AWS'];
      const genericWords = ['advanced', 'specialized', 'comprehensive', 'remote', 'virtual', 'accessible', 'quality', 'modern', 'innovative', 'seek', 'find'];
      
      const detectedNames = result.data.mentions.map(m => m.name.toLowerCase());
      const correctBrands = expectedBrands.filter(brand => 
        detectedNames.some(detected => detected.includes(brand.toLowerCase()) || brand.toLowerCase().includes(detected))
      );
      const incorrectGeneric = genericWords.filter(word => 
        detectedNames.some(detected => detected === word.toLowerCase())
      );
      
      console.log(`✅ Correctly identified brands: ${correctBrands.join(', ') || 'None'}`);
      console.log(`❌ Incorrectly tagged generic words: ${incorrectGeneric.join(', ') || 'None'}`);
      
      const accuracy = expectedBrands.length > 0 ? (correctBrands.length / expectedBrands.length * 100) : 0;
      console.log(`📈 Brand detection accuracy: ${accuracy.toFixed(1)}%`);
      
      if (incorrectGeneric.length === 0) {
        console.log('🎯 Perfect! No generic words were incorrectly tagged as brands.');
      } else {
        console.log('⚠️ Some generic words were incorrectly tagged as brands.');
      }
    } else {
      console.log('ℹ️ No mentions detected');
    }
    
    console.log('✅ Mention agent test completed');
  } catch (error) {
    console.error('❌ Mention agent test failed:', error.message);
    process.exit(1);
  }
})();