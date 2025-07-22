#!/usr/bin/env node

// Iterative improvement test for mention agent with specific problematic cases
process.env.NODE_ENV = 'development';
process.env.SECRETS_PROVIDER = 'aws';
process.env.DATABASE_SECRET_NAME = 'serplexity-db';
process.env.AWS_ACCESS_KEY_ID = 'AKIAVFIWIQECD5NKMCUX';
process.env.AWS_SECRET_ACCESS_KEY = '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';
process.env.AWS_REGION = 'us-east-2';

const { pydanticLlmService } = require('./dist/services/pydanticLlmService');

// Focus on the most challenging cases that still have issues
const iterativeTests = [
  {
    name: "High-Precision Homonym Challenge",
    description: "Focus on contexts where words MUST NOT be tagged as brands",
    text: `When customers target better deals during sales events, they often seek comprehensive solutions. People discover new opportunities through networking while companies chase market share. Employees slack off during breaks, but they scale their efforts when deadlines approach. Advanced technologies help businesses find innovative approaches. Remote workers access virtual platforms to collaborate effectively. Smart strategies drive modern solutions in today's competitive market.`,
    expected: {
      brands: [],  // NO brands should be detected - all are generic usage
      products: [], // NO products should be detected
      avoid: ['target', 'seek', 'discover', 'chase', 'slack', 'scale', 'find', 'access', 'advanced', 'remote', 'virtual', 'smart', 'modern', 'competitive', 'comprehensive', 'innovative', 'effective', 'solutions', 'approaches', 'strategies', 'technologies', 'platforms']
    }
  },
  {
    name: "Mixed Context - Brand vs Generic",
    description: "Same words used as both brands and generic terms in same text",
    text: `Target Corporation announced new target demographics for their marketing campaign. Apple Inc. released updates while farmers harvest apple crops in orchards. Square payments help merchants, though some prefer square dance competitions. Chase Bank customers don't always chase after promotional rates. Slack Technologies improves communication, but productivity can slack during holiday seasons. Amazon Web Services dominates cloud computing while the Amazon rainforest faces deforestation challenges.`,
    expected: {
      brands: ['Target Corporation', 'Apple Inc.', 'Chase Bank', 'Slack Technologies', 'Amazon Web Services'], 
      products: ['Square', 'Amazon Web Services'],
      avoid: ['target', 'demographics', 'marketing', 'campaign', 'harvest', 'apple', 'crops', 'orchards', 'square', 'dance', 'competitions', 'customers', 'chase', 'promotional', 'rates', 'communication', 'productivity', 'slack', 'holiday', 'seasons', 'cloud', 'computing', 'rainforest', 'deforestation', 'challenges']
    }
  },
  {
    name: "Corporate Suffix Precision Test",
    description: "Test ability to detect vs ignore based on corporate context indicators",
    text: `Progressive policies help governments while Progressive Insurance provides coverage. General guidelines apply broadly, but General Electric manufactures products. Universal concepts are taught in schools while Universal Studios creates entertainment. Advanced techniques are used everywhere, but Advanced Micro Devices makes semiconductors. Conservative approaches work sometimes, though Conservative Media Group publishes content. Dynamic processes improve efficiency while Dynamic Systems builds software.`,
    expected: {
      brands: ['Progressive Insurance', 'General Electric', 'Universal Studios', 'Advanced Micro Devices', 'Conservative Media Group', 'Dynamic Systems'],
      avoid: ['progressive', 'policies', 'governments', 'general', 'guidelines', 'universal', 'concepts', 'schools', 'advanced', 'techniques', 'conservative', 'approaches', 'dynamic', 'processes', 'efficiency']
    }
  },
  {
    name: "Action Verb Disambiguation",
    description: "Test precision with action verbs that are also brand names",
    text: `Teams collaborate using various tools while Microsoft Teams facilitates meetings. Users zoom in on details during zoom video calls with Zoom. Workers buffer against stress while Buffer schedules social posts. Companies scale operations as Scale AI processes data. Customers discover benefits when using Discover credit cards. People chase dreams while Chase provides banking services.`,
    expected: {
      brands: ['Microsoft Teams', 'Zoom', 'Buffer', 'Scale AI', 'Discover', 'Chase'],
      products: ['Microsoft Teams', 'Zoom', 'Buffer', 'Discover'],
      avoid: ['collaborate', 'tools', 'facilitate', 'meetings', 'zoom', 'in', 'details', 'video', 'calls', 'buffer', 'against', 'stress', 'schedules', 'social', 'posts', 'scale', 'operations', 'processes', 'data', 'discover', 'benefits', 'credit', 'cards', 'chase', 'dreams', 'banking', 'services']
    }
  }
];

async function runIterativeTest() {
  console.log('🔬 ITERATIVE MENTION AGENT REFINEMENT');
  console.log('=' .repeat(80));
  console.log('Testing specific problematic cases for precision improvement...\n');

  let overallPrecisionScore = 0;
  let overallRecallScore = 0;
  let totalFalsePositives = 0;
  let totalMissed = 0;

  for (let i = 0; i < iterativeTests.length; i++) {
    const test = iterativeTests[i];
    console.log(`🎯 Test ${i + 1}: ${test.name}`);
    console.log(`📝 Description: ${test.description}`);
    console.log('-'.repeat(70));
    
    try {
      const result = await pydanticLlmService.executeAgent(
        "mention_agent.py",
        {
          text: test.text,
          company_name: "Test Company", 
          competitors: []
        },
        null,
        { modelId: "openai:gpt-4o-mini", timeout: 60000 }
      );

      if (result.data?.mentions) {
        const mentions = result.data.mentions;
        const detectedNames = mentions.map(m => m.name);
        
        const expectedBrands = test.expected.brands || [];
        const expectedProducts = test.expected.products || [];
        const allExpected = [...expectedBrands, ...expectedProducts];
        const avoidWords = test.expected.avoid || [];
        
        // Analyze results
        const correctDetections = allExpected.filter(expected => 
          detectedNames.some(detected => 
            detected.toLowerCase().includes(expected.toLowerCase()) || 
            expected.toLowerCase().includes(detected.toLowerCase())
          )
        );
        
        const falsePositives = detectedNames.filter(detected =>
          avoidWords.some(avoid => avoid.toLowerCase() === detected.toLowerCase())
        );

        const missed = allExpected.filter(expected =>
          !detectedNames.some(detected => 
            detected.toLowerCase().includes(expected.toLowerCase()) || 
            expected.toLowerCase().includes(detected.toLowerCase())
          )
        );

        const precision = mentions.length > 0 ? correctDetections.length / mentions.length : 0;
        const recall = allExpected.length > 0 ? correctDetections.length / allExpected.length : 1; // If no expected, perfect recall if none detected

        overallPrecisionScore += precision;
        overallRecallScore += recall;
        totalFalsePositives += falsePositives.length;
        totalMissed += missed.length;

        console.log(`📊 Results:`);
        console.log(`   • Detected: ${mentions.length} mentions`);
        console.log(`   • Expected: ${allExpected.length} brands/products`);
        console.log(`   • Correct: ${correctDetections.length}`);
        console.log(`   • False Positives (avoid words): ${falsePositives.length}`);
        console.log(`   • Missed: ${missed.length}`);
        console.log(`   • Precision: ${(precision * 100).toFixed(1)}%`);
        console.log(`   • Recall: ${(recall * 100).toFixed(1)}%`);

        if (correctDetections.length > 0) {
          console.log(`   ✅ Correct: ${correctDetections.join(', ')}`);
        }
        if (falsePositives.length > 0) {
          console.log(`   ❌ False Positives: ${falsePositives.join(', ')}`);
        }
        if (missed.length > 0) {
          console.log(`   ⏭️  Missed: ${missed.join(', ')}`);
        }

        // Detailed analysis for improvement
        console.log('\n🔍 DETAILED ANALYSIS:');
        
        // Show examples of correct disambiguation
        const goodCases = mentions.filter(m => 
          allExpected.some(exp => 
            exp.toLowerCase().includes(m.name.toLowerCase()) || 
            m.name.toLowerCase().includes(exp.toLowerCase())
          )
        );
        if (goodCases.length > 0) {
          console.log(`   🎯 Correctly identified despite ambiguity:`);
          goodCases.slice(0, 3).forEach(mention => {
            console.log(`      "${mention.name}" - ${mention.context}`);
          });
        }

        // Show problematic false positives
        if (falsePositives.length > 0) {
          console.log(`   ⚠️  Problematic false positives to fix:`);
          const problematicMentions = mentions.filter(m => 
            falsePositives.some(fp => fp.toLowerCase() === m.name.toLowerCase())
          );
          problematicMentions.slice(0, 3).forEach(mention => {
            console.log(`      "${mention.name}" - ${mention.context}`);
          });
        }

      } else {
        console.log('📊 No mentions detected');
        const expectedCount = (test.expected.brands?.length || 0) + (test.expected.products?.length || 0);
        if (expectedCount === 0) {
          console.log('   ✅ Correct - no brands should be detected');
          overallPrecisionScore += 1;
          overallRecallScore += 1;
        } else {
          console.log(`   ❌ Missed ${expectedCount} expected brands/products`);
          totalMissed += expectedCount;
          overallRecallScore += 0;
        }
      }

    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
    }

    console.log('\n');
  }

  // Overall refinement analysis
  console.log('🎯 REFINEMENT ANALYSIS');
  console.log('=' .repeat(80));
  
  const avgPrecision = overallPrecisionScore / iterativeTests.length;
  const avgRecall = overallRecallScore / iterativeTests.length;
  const f1Score = (2 * avgPrecision * avgRecall) / Math.max(avgPrecision + avgRecall, 1);

  console.log(`📈 Average Precision: ${(avgPrecision * 100).toFixed(1)}%`);
  console.log(`📈 Average Recall: ${(avgRecall * 100).toFixed(1)}%`);
  console.log(`📈 F1 Score: ${(f1Score * 100).toFixed(1)}%`);
  console.log(`❌ Total False Positives: ${totalFalsePositives}`);
  console.log(`⏭️  Total Missed: ${totalMissed}`);

  console.log('\n💡 REFINEMENT RECOMMENDATIONS:');
  
  if (totalFalsePositives > 5) {
    console.log('🔧 HIGH PRIORITY: Reduce false positives');
    console.log('   → Strengthen generic word detection');
    console.log('   → Add more specific context requirements');
    console.log('   → Increase confidence thresholds');
  }
  
  if (totalMissed > 3) {
    console.log('🔧 MEDIUM PRIORITY: Improve recall');
    console.log('   → Add more brand recognition patterns');
    console.log('   → Lower confidence thresholds for clear cases');
  }
  
  if (avgPrecision > 0.9 && avgRecall > 0.9 && totalFalsePositives < 3) {
    console.log('🏆 EXCELLENT: Agent is performing at production quality!');
  } else if (avgPrecision > 0.8 && avgRecall > 0.8 && totalFalsePositives < 7) {
    console.log('✅ GOOD: Agent performance is solid with room for fine-tuning');
  } else {
    console.log('⚠️ NEEDS WORK: Significant improvements needed');
  }

  console.log(`\n📊 Difficulty Score: ${totalFalsePositives + totalMissed} errors across ${iterativeTests.length} challenging tests`);
  console.log('\n🏁 ITERATIVE REFINEMENT TEST COMPLETED');
  
  return { avgPrecision, avgRecall, f1Score, totalFalsePositives, totalMissed };
}

// Run the iterative test
runIterativeTest().catch(error => {
  console.error('❌ Iterative test failed:', error.message);
  process.exit(1);
});