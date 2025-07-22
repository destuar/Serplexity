#!/usr/bin/env node

/**
 * Test script for intelligent brand mention detection
 * Tests the context-aware LLM to distinguish between brand names and generic words
 */

const { spawn } = require('child_process');
const path = require('path');

// Test paragraph with both real brands and generic words that could be mistaken for brands
const testText = `
For advanced surgical procedures, patients often seek specialized care at top medical institutions. 
Mayo Clinic offers comprehensive cardiac surgery programs, while Johns Hopkins Hospital provides 
cutting-edge neurosurgery services. Many patients also consider Cleveland Clinic for their 
specialized orthopedic treatments. 

Remote consultations have become more accessible through telemedicine platforms. Virtual healthcare 
services are now available through companies like Teladoc and Amwell. These platforms seek to 
provide quality care while maintaining patient privacy.

In the technology sector, Apple continues to innovate with the iPhone, while Microsoft enhances 
productivity through Office 365. Google's search capabilities and Amazon's cloud services (AWS) 
dominate their respective markets. Tesla's electric vehicles represent the future of sustainable 
transportation.

Patients should access comprehensive information about their treatment options. They need to find 
providers who offer modern, innovative solutions for their healthcare needs.
`;

const testInput = {
  text: testText.trim(),
  company_name: "Mayo Clinic",
  competitors: ["Johns Hopkins Hospital", "Cleveland Clinic", "Cedars-Sinai"]
};

console.log('🧪 Testing Intelligent Brand Mention Detection');
console.log('='.repeat(60));
console.log('📝 Test Text:');
console.log(testText.trim());
console.log('='.repeat(60));

function runMentionAgent() {
  return new Promise((resolve, reject) => {
    const agentPath = path.join(__dirname, 'src/pydantic_agents/agents/mention_agent.py');
    const process = spawn('python3', [agentPath], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    process.stdin.write(JSON.stringify(testInput));
    process.stdin.end();

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}\nStdout: ${stdout}`));
        }
      } else {
        reject(new Error(`Process exited with code ${code}\nStderr: ${stderr}\nStdout: ${stdout}`));
      }
    });

    process.on('error', (error) => {
      reject(new Error(`Failed to start process: ${error.message}`));
    });
  });
}

async function main() {
  try {
    console.log('🚀 Running mention detection...');
    const result = await runMentionAgent();

    console.log('\n📊 RESULTS:');
    console.log('='.repeat(60));

    if (result.error) {
      console.error('❌ Error:', result.error);
      return;
    }

    const mentions = result.result?.mentions || [];
    console.log(`Total mentions found: ${mentions.length}`);
    console.log(`Execution time: ${result.execution_time}ms`);
    console.log(`Model used: ${result.model_used}`);

    if (mentions.length === 0) {
      console.log('ℹ️ No mentions detected');
      return;
    }

    console.log('\n🏷️ DETECTED MENTIONS:');
    console.log('-'.repeat(60));

    // Group by type for better analysis
    const brands = mentions.filter(m => m.type === 'brand');
    const products = mentions.filter(m => m.type === 'product');

    console.log(`\n🏢 BRANDS (${brands.length}):`);
    brands
      .sort((a, b) => b.confidence - a.confidence)
      .forEach((mention, i) => {
        console.log(`  ${i + 1}. ${mention.name} (${mention.confidence}) - ${mention.category}`);
        console.log(`     Context: "${mention.context}"`);
      });

    console.log(`\n📦 PRODUCTS (${products.length}):`);
    products
      .sort((a, b) => b.confidence - a.confidence)
      .forEach((mention, i) => {
        console.log(`  ${i + 1}. ${mention.name} (${mention.confidence}) - ${mention.category}`);
        console.log(`     Context: "${mention.context}"`);
      });

    // Analysis
    console.log('\n🔍 ANALYSIS:');
    console.log('-'.repeat(60));

    const expectedBrands = ['Mayo Clinic', 'Johns Hopkins Hospital', 'Cleveland Clinic', 'Apple', 'Microsoft', 'Google', 'Amazon', 'Tesla', 'Teladoc'];
    const expectedProducts = ['iPhone', 'Office 365', 'AWS'];
    const genericWords = ['advanced', 'specialized', 'comprehensive', 'remote', 'virtual', 'accessible', 'quality', 'modern', 'innovative'];

    const detectedNames = mentions.map(m => m.name.toLowerCase());
    const correctBrands = expectedBrands.filter(brand => 
      detectedNames.some(detected => detected.includes(brand.toLowerCase()))
    );
    const incorrectGeneric = genericWords.filter(word => 
      detectedNames.some(detected => detected.includes(word.toLowerCase()))
    );

    console.log(`✅ Correctly identified brands: ${correctBrands.join(', ')}`);
    console.log(`❌ Incorrectly tagged generic words: ${incorrectGeneric.join(', ') || 'None'}`);
    
    const accuracy = correctBrands.length / expectedBrands.length * 100;
    console.log(`📈 Brand detection accuracy: ${accuracy.toFixed(1)}%`);

    if (incorrectGeneric.length === 0) {
      console.log('🎯 Perfect! No generic words were incorrectly tagged as brands.');
    } else {
      console.log('⚠️ Some generic words were incorrectly tagged as brands.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();