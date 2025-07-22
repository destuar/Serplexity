#!/usr/bin/env node

// Stress test with challenging edge cases and ambiguous contexts
process.env.NODE_ENV = 'development';
process.env.SECRETS_PROVIDER = 'aws';
process.env.DATABASE_SECRET_NAME = 'serplexity-db';
process.env.AWS_ACCESS_KEY_ID = 'AKIAVFIWIQECD5NKMCUX';
process.env.AWS_SECRET_ACCESS_KEY = '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';
process.env.AWS_REGION = 'us-east-2';

const { pydanticLlmService } = require('./dist/services/pydanticLlmService');

// Challenging edge cases that often confuse brand detection systems
const stressCases = [
  {
    name: "Homonyms and Common Words as Brand Names",
    text: `Target announced new partnerships while customers target better deals. Apple's latest iPhone release coincided with apple harvest season in Washington. Amazon rainforest conservation efforts are separate from Amazon's e-commerce platform. Square dance competitions happen while Square processes payments. Oracle database systems help predict oracle-like insights. Shell oil company operates differently from shell scripts in programming. Meta platforms focus on the metaverse while meta-analysis provides research insights. The company aims to deliver results while Uber delivers food through Uber Eats.`,
    expected: {
      brands: ['Target', 'Apple', 'Amazon', 'Square', 'Oracle', 'Shell', 'Meta', 'Uber'],
      products: ['iPhone', 'Uber Eats'],
      avoid: ['target', 'apple', 'oracle-like', 'meta-analysis', 'shell', 'aims', 'deliver', 'results', 'customers', 'partnerships', 'latest', 'release', 'season', 'conservation', 'efforts', 'separate', 'competitions', 'systems', 'insights', 'platforms', 'focus', 'provides', 'research']
    }
  },
  {
    name: "Industry Jargon and Technical Terms",
    text: `The cloud infrastructure market includes Amazon Web Services, Google Cloud, and Microsoft Azure. Cloud computing has become essential for scaling applications. Docker containers help with application deployment while Docker Inc. provides container solutions. Kubernetes orchestrates containers while the kubernetes community contributes to open source. Git version control is used by developers, while GitHub and GitLab offer hosting services. Python programming language powers many applications, although Python Software Foundation maintains the language. Java applications run on various platforms, but Oracle owns the Java trademark.`,
    expected: {
      brands: ['Amazon Web Services', 'Google Cloud', 'Microsoft Azure', 'Docker Inc.', 'GitHub', 'GitLab', 'Python Software Foundation', 'Oracle'],
      products: ['Amazon Web Services', 'Google Cloud', 'Microsoft Azure'],
      avoid: ['cloud', 'infrastructure', 'computing', 'scaling', 'applications', 'containers', 'deployment', 'solutions', 'orchestrates', 'community', 'contributes', 'open', 'source', 'version', 'control', 'developers', 'hosting', 'services', 'programming', 'language', 'powers', 'maintains', 'platforms', 'trademark']
    }
  },
  {
    name: "Geographic and Generic Terms",
    text: `Berkshire Hathaway invests in various berkshire companies. California-based companies like California Pizza Kitchen compete with local california pizza restaurants. Boston Consulting Group operates beyond boston consulting services. Goldman Sachs provides goldman-level financial services. Morgan Stanley and JP Morgan are different from morgan genealogy research. American Express differs from american express delivery services. General Electric produces general electric appliances. Universal Studios creates universal entertainment content while universal healthcare remains a policy topic.`,
    expected: {
      brands: ['Berkshire Hathaway', 'California Pizza Kitchen', 'Boston Consulting Group', 'Goldman Sachs', 'Morgan Stanley', 'JP Morgan', 'American Express', 'General Electric', 'Universal Studios'],
      avoid: ['berkshire', 'companies', 'california', 'restaurants', 'boston', 'consulting', 'services', 'goldman-level', 'financial', 'morgan', 'genealogy', 'research', 'american', 'express', 'delivery', 'general', 'electric', 'appliances', 'universal', 'entertainment', 'content', 'healthcare', 'policy', 'topic']
    }
  },
  {
    name: "Adjectives That Are Also Brand Names",
    text: `Advanced Micro Devices creates advanced micro processors. Intelligent Systems provides intelligent automation solutions. Progressive Insurance offers progressive policy updates. Liberal Media Group has liberal editorial policies. Conservative Political Action uses conservative messaging strategies. Modern Healthcare magazine covers modern healthcare trends. Premium Brands Corporation sells premium brand products. Smart Technologies develops smart technology solutions for education. Dynamic Systems builds dynamic software applications.`,
    expected: {
      brands: ['Advanced Micro Devices', 'Intelligent Systems', 'Progressive Insurance', 'Liberal Media Group', 'Conservative Political Action', 'Modern Healthcare', 'Premium Brands Corporation', 'Smart Technologies', 'Dynamic Systems'],
      avoid: ['advanced', 'micro', 'processors', 'intelligent', 'automation', 'solutions', 'progressive', 'policy', 'updates', 'liberal', 'editorial', 'policies', 'conservative', 'messaging', 'strategies', 'modern', 'healthcare', 'trends', 'premium', 'brand', 'products', 'smart', 'technology', 'education', 'dynamic', 'software', 'applications']
    }
  },
  {
    name: "Action Verbs as Brand Names", 
    text: `Zoom video calls have increased while Zoom Video Communications stock rises. Slack messaging improves team communication although work can slack during breaks. Teams collaborate better with Microsoft Teams software. Discover credit cards help customers discover new rewards. Chase bank customers chase better interest rates. Buffer social media tool helps buffer against marketing challenges. Scale AI helps companies scale their operations. Stripe payment processing helps businesses stripe away payment complexity. Square point-of-sale systems help square away transaction issues.`,
    expected: {
      brands: ['Zoom Video Communications', 'Microsoft Teams', 'Discover', 'Chase', 'Buffer', 'Scale AI', 'Stripe', 'Square'],
      products: ['Zoom', 'Microsoft Teams', 'Discover', 'Buffer', 'Stripe', 'Square'],
      avoid: ['video', 'calls', 'increased', 'stock', 'rises', 'messaging', 'improves', 'communication', 'slack', 'breaks', 'collaborate', 'better', 'software', 'customers', 'discover', 'rewards', 'chase', 'interest', 'rates', 'social', 'media', 'tool', 'helps', 'challenges', 'companies', 'scale', 'operations', 'payment', 'processing', 'businesses', 'stripe', 'away', 'complexity', 'point-of-sale', 'systems', 'square', 'away', 'transaction', 'issues']
    }
  }
];

async function runStressTest() {
  console.log('🔥 STRESS TEST - CHALLENGING EDGE CASES');
  console.log('=' .repeat(80));
  console.log('Testing ambiguous contexts, homonyms, and tricky scenarios...\n');

  let totalCorrect = 0;
  let totalExpected = 0;
  let totalIncorrect = 0;
  let totalFalsePositives = 0;
  let allResults = [];

  for (let i = 0; i < stressCases.length; i++) {
    const testCase = stressCases[i];
    console.log(`🎯 Stress Test ${i + 1}: ${testCase.name}`);
    console.log('-'.repeat(70));
    
    try {
      const result = await pydanticLlmService.executeAgent(
        "mention_agent.py",
        {
          text: testCase.text,
          company_name: "Test Company",
          competitors: []
        },
        null,
        { modelId: "openai:gpt-4o-mini", timeout: 60000 }
      );

      if (result.data?.mentions) {
        const mentions = result.data.mentions;
        const detectedNames = mentions.map(m => m.name);
        
        // Count correct detections
        const expectedBrands = testCase.expected.brands || [];
        const expectedProducts = testCase.expected.products || [];
        const allExpected = [...expectedBrands, ...expectedProducts];
        const avoidWords = testCase.expected.avoid || [];
        
        const correctDetections = allExpected.filter(expected => 
          detectedNames.some(detected => 
            detected.toLowerCase().includes(expected.toLowerCase()) || 
            expected.toLowerCase().includes(detected.toLowerCase())
          )
        );
        
        // Count false positives (should avoid words)
        const falsePositives = detectedNames.filter(detected =>
          avoidWords.some(avoid => avoid.toLowerCase() === detected.toLowerCase())
        );

        // Count other false positives (detected but not in expected or avoid list)
        const otherFalsePositives = detectedNames.filter(detected =>
          !allExpected.some(expected => 
            detected.toLowerCase().includes(expected.toLowerCase()) || 
            expected.toLowerCase().includes(detected.toLowerCase())
          ) && !avoidWords.some(avoid => avoid.toLowerCase() === detected.toLowerCase())
        );

        totalCorrect += correctDetections.length;
        totalExpected += allExpected.length;
        totalIncorrect += falsePositives.length;
        totalFalsePositives += falsePositives.length + otherFalsePositives.length;

        const precision = mentions.length > 0 ? correctDetections.length / mentions.length : 0;
        const recall = allExpected.length > 0 ? correctDetections.length / allExpected.length : 0;

        console.log(`📊 Detected: ${mentions.length} mentions`);
        console.log(`✅ Correct: ${correctDetections.length}/${allExpected.length} (${(recall*100).toFixed(1)}% recall)`);
        console.log(`📈 Precision: ${(precision*100).toFixed(1)}%`);
        console.log(`❌ False positives (avoid words): ${falsePositives.length}`);
        console.log(`❓ Other detections: ${otherFalsePositives.length}`);
        
        if (correctDetections.length > 0) {
          console.log(`   ✅ Correct: ${correctDetections.slice(0, 10).join(', ')}`);
        }
        if (falsePositives.length > 0) {
          console.log(`   ❌ Should avoid: ${falsePositives.join(', ')}`);
        }
        if (otherFalsePositives.length > 0) {
          console.log(`   ❓ Other detections: ${otherFalsePositives.slice(0, 5).join(', ')}`);
        }

        // Show challenging cases handled correctly
        console.log('\n🧠 CHALLENGING CASES ANALYSIS:');
        const challengingCorrect = correctDetections.filter(correct => 
          avoidWords.some(avoid => correct.toLowerCase().includes(avoid.toLowerCase()))
        );
        if (challengingCorrect.length > 0) {
          console.log(`   🎯 Correctly identified despite ambiguity: ${challengingCorrect.join(', ')}`);
        }

        allResults.push({
          testCase: testCase.name,
          detected: mentions.length,
          correct: correctDetections.length,
          expected: allExpected.length,
          falsePositives: falsePositives.length,
          otherDetections: otherFalsePositives.length,
          precision,
          recall,
          f1: precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0
        });

      } else {
        console.log('❌ No mentions detected');
        totalExpected += (testCase.expected.brands?.length || 0) + (testCase.expected.products?.length || 0);
        
        allResults.push({
          testCase: testCase.name,
          detected: 0,
          correct: 0,
          expected: (testCase.expected.brands?.length || 0) + (testCase.expected.products?.length || 0),
          falsePositives: 0,
          otherDetections: 0,
          precision: 0,
          recall: 0,
          f1: 0
        });
      }

    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
    }

    console.log('\n');
  }

  // Overall stress test results
  console.log('🎯 STRESS TEST RESULTS');
  console.log('=' .repeat(80));
  
  const overallPrecision = totalCorrect / Math.max(totalCorrect + totalFalsePositives, 1);
  const overallRecall = totalCorrect / Math.max(totalExpected, 1);
  const f1Score = (2 * overallPrecision * overallRecall) / Math.max(overallPrecision + overallRecall, 1);

  console.log(`📊 Total Expected: ${totalExpected} brands/products`);
  console.log(`✅ Total Correct: ${totalCorrect}`);
  console.log(`❌ Total False Positives: ${totalFalsePositives}`);
  console.log(`📈 Overall Precision: ${(overallPrecision * 100).toFixed(1)}%`);
  console.log(`📈 Overall Recall: ${(overallRecall * 100).toFixed(1)}%`);
  console.log(`📈 F1 Score: ${(f1Score * 100).toFixed(1)}%`);

  // Difficulty analysis
  console.log('\n🏆 DIFFICULTY ANALYSIS:');
  allResults.forEach((result, idx) => {
    console.log(`${idx+1}. ${result.testCase}`);
    console.log(`   Precision: ${(result.precision * 100).toFixed(1)}% | Recall: ${(result.recall * 100).toFixed(1)}% | F1: ${(result.f1 * 100).toFixed(1)}%`);
    console.log(`   Challenge Level: ${result.falsePositives + result.otherDetections > 2 ? '🔥 HIGH' : 
                                       result.falsePositives + result.otherDetections > 0 ? '⚠️ MEDIUM' : '✅ HANDLED WELL'}`);
  });

  // Performance insights for stress test
  console.log('\n💡 STRESS TEST INSIGHTS:');
  const avgPrecision = allResults.reduce((sum, r) => sum + r.precision, 0) / allResults.length;
  const avgRecall = allResults.reduce((sum, r) => sum + r.recall, 0) / allResults.length;
  const totalChallenges = totalFalsePositives + totalIncorrect;

  if (avgPrecision > 0.9 && avgRecall > 0.9 && totalChallenges < 5) {
    console.log('🏆 OUTSTANDING: Agent handles challenging edge cases exceptionally well!');
  } else if (avgPrecision > 0.8 && avgRecall > 0.8 && totalChallenges < 10) {
    console.log('🎯 EXCELLENT: Agent performs well on most challenging scenarios');
  } else if (avgPrecision > 0.7 && avgRecall > 0.7) {
    console.log('✅ GOOD: Agent handles edge cases reasonably well');
  } else {
    console.log('⚠️ NEEDS IMPROVEMENT: Edge cases require prompt refinement');
  }

  console.log(`📊 Edge Case Difficulty Score: ${totalChallenges} issues out of ${totalExpected} challenges`);
  console.log('\n🏁 STRESS TEST COMPLETED');
  
  return { avgPrecision, avgRecall, f1Score, totalChallenges };
}

// Run the stress test
runStressTest().catch(error => {
  console.error('❌ Stress test failed:', error.message);
  process.exit(1);
});