#!/usr/bin/env node

// Comprehensive mention agent test across industries and company sizes
process.env.NODE_ENV = 'development';
process.env.SECRETS_PROVIDER = 'aws';
process.env.DATABASE_SECRET_NAME = 'serplexity-db';
process.env.AWS_ACCESS_KEY_ID = 'AKIAVFIWIQECD5NKMCUX';
process.env.AWS_SECRET_ACCESS_KEY = '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';
process.env.AWS_REGION = 'us-east-2';

const { pydanticLlmService } = require('./dist/services/pydanticLlmService');

// Comprehensive test dataset covering multiple industries and edge cases
const testCases = [
  {
    name: "Healthcare Giants vs Startups",
    text: `Healthcare delivery has transformed with major players like Mayo Clinic and Cleveland Clinic leading traditional care, while innovative startups like Ro (formerly Roman) and Hims & Hers are disrupting telemedicine. Johnson & Johnson continues pharmaceutical innovation alongside smaller biotech firms like Moderna and BioNTech. Digital health platforms such as Teladoc Health compete with emerging solutions from Forward and One Medical. Traditional insurance giants UnitedHealth Group and Anthem face competition from newcomers like Oscar Health. Many patients seek specialized care, finding comprehensive solutions through virtual consultations and remote monitoring.`,
    expected: {
      brands: ['Mayo Clinic', 'Cleveland Clinic', 'Ro', 'Hims & Hers', 'Johnson & Johnson', 'Moderna', 'BioNTech', 'Teladoc Health', 'Forward', 'One Medical', 'UnitedHealth Group', 'Anthem', 'Oscar Health'],
      avoid: ['specialized', 'comprehensive', 'virtual', 'remote', 'seek', 'finding', 'solutions', 'innovative', 'traditional', 'major', 'digital']
    }
  },
  {
    name: "Tech Giants vs Unicorns vs Small SaaS",
    text: `The technology landscape includes established giants like Microsoft, Google, and Amazon Web Services (AWS), competing with unicorns such as Stripe, Databricks, and Figma. Smaller but innovative SaaS companies like Notion, Linear, and Vercel are gaining market share. Enterprise software from Salesforce and ServiceNow faces challenges from agile startups like Airtable and Monday.com. Cloud infrastructure provided by Microsoft Azure and Google Cloud Platform competes with specialized providers like DigitalOcean and Linode. Developers often choose between GitHub (owned by Microsoft) and GitLab for version control, while seeking efficient workflows and modern development tools.`,
    expected: {
      brands: ['Microsoft', 'Google', 'Amazon Web Services', 'AWS', 'Stripe', 'Databricks', 'Figma', 'Notion', 'Linear', 'Vercel', 'Salesforce', 'ServiceNow', 'Airtable', 'Monday.com', 'Microsoft Azure', 'Google Cloud Platform', 'DigitalOcean', 'Linode', 'GitHub', 'GitLab'],
      products: ['AWS', 'Microsoft Azure', 'Google Cloud Platform'],
      avoid: ['established', 'innovative', 'agile', 'specialized', 'efficient', 'modern', 'seeking', 'choose', 'development', 'tools', 'workflows', 'market', 'share']
    }
  },
  {
    name: "Financial Services Mix",
    text: `Traditional banking institutions like JPMorgan Chase, Bank of America, and Wells Fargo compete with fintech disruptors such as Chime, Robinhood, and Square (now Block). Investment platforms from Fidelity and Charles Schwab face competition from newer entrants like Webull and Public. Cryptocurrency exchanges including Coinbase and Binance offer alternative financial services, while payment processors like PayPal and Visa maintain market positions. Credit card companies American Express and Mastercard adapt to digital-first approaches. Small businesses often access modern banking solutions, seeking comprehensive financial management tools and innovative payment processing options.`,
    expected: {
      brands: ['JPMorgan Chase', 'Bank of America', 'Wells Fargo', 'Chime', 'Robinhood', 'Square', 'Block', 'Fidelity', 'Charles Schwab', 'Webull', 'Public', 'Coinbase', 'Binance', 'PayPal', 'Visa', 'American Express', 'Mastercard'],
      avoid: ['traditional', 'modern', 'digital-first', 'innovative', 'comprehensive', 'seeking', 'access', 'management', 'tools', 'options', 'solutions', 'services', 'financial', 'payment', 'processing']
    }
  },
  {
    name: "Retail and E-commerce Spectrum",
    text: `E-commerce is dominated by Amazon and Shopify platforms, while traditional retailers like Walmart and Target enhance their digital presence. Direct-to-consumer brands such as Warby Parker, Casper, and Allbirds compete with established fashion retailers. Specialty e-commerce platforms like Etsy for handmade goods and eBay for auctions serve niche markets. Beauty brands like Glossier and Fenty Beauty leverage social media marketing. Food delivery services including DoorDash, Uber Eats, and Grubhub transform restaurant ordering. Fashion retailers like Zara and H&M compete with online-first brands like ASOS and Shein. Consumers frequently browse multiple platforms, comparing prices and seeking quality products with fast delivery options.`,
    expected: {
      brands: ['Amazon', 'Shopify', 'Walmart', 'Target', 'Warby Parker', 'Casper', 'Allbirds', 'Etsy', 'eBay', 'Glossier', 'Fenty Beauty', 'DoorDash', 'Uber Eats', 'Grubhub', 'Zara', 'H&M', 'ASOS', 'Shein'],
      avoid: ['digital', 'established', 'specialty', 'niche', 'quality', 'fast', 'delivery', 'options', 'seeking', 'comparing', 'browse', 'multiple', 'platforms', 'frequently', 'transform', 'enhance', 'compete']
    }
  },
  {
    name: "Enterprise Software Edge Cases",
    text: `Enterprise resource planning solutions from SAP and Oracle compete with cloud-native alternatives like Workday and NetSuite. Customer relationship management is led by Salesforce, while HubSpot and Pipedrive serve smaller markets. Communication tools have evolved from email to platforms like Slack, Microsoft Teams, and Discord. Project management software including Asana, Trello, and Jira helps teams collaborate effectively. Business intelligence tools from Tableau and Power BI compete with newer solutions like Looker and Metabase. Companies often integrate multiple software solutions, seeking seamless workflows and comprehensive data analytics capabilities.`,
    expected: {
      brands: ['SAP', 'Oracle', 'Workday', 'NetSuite', 'Salesforce', 'HubSpot', 'Pipedrive', 'Slack', 'Microsoft Teams', 'Discord', 'Asana', 'Trello', 'Jira', 'Tableau', 'Power BI', 'Looker', 'Metabase'],
      products: ['SAP', 'Oracle', 'Workday', 'NetSuite', 'Salesforce', 'HubSpot', 'Pipedrive', 'Slack', 'Microsoft Teams', 'Discord', 'Asana', 'Trello', 'Jira', 'Tableau', 'Power BI', 'Looker', 'Metabase'],
      avoid: ['enterprise', 'solutions', 'alternatives', 'cloud-native', 'smaller', 'markets', 'platforms', 'collaborate', 'effectively', 'comprehensive', 'capabilities', 'seamless', 'workflows', 'seeking', 'integrate', 'multiple', 'software', 'data', 'analytics']
    }
  }
];

async function runComprehensiveTest() {
  console.log('🚀 COMPREHENSIVE MENTION AGENT TEST');
  console.log('=' .repeat(80));
  console.log('Testing across industries, company sizes, and edge cases...\n');

  let totalCorrect = 0;
  let totalExpected = 0;
  let totalIncorrect = 0;
  let allResults = [];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`📝 Test Case ${i + 1}: ${testCase.name}`);
    console.log('-'.repeat(60));
    
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
        
        const incorrectDetections = detectedNames.filter(detected =>
          avoidWords.some(avoid => avoid.toLowerCase() === detected.toLowerCase())
        );

        totalCorrect += correctDetections.length;
        totalExpected += allExpected.length;
        totalIncorrect += incorrectDetections.length;

        console.log(`📊 Detected: ${mentions.length} mentions`);
        console.log(`✅ Correct: ${correctDetections.length}/${allExpected.length} (${((correctDetections.length/allExpected.length)*100).toFixed(1)}%)`);
        console.log(`❌ Generic words tagged: ${incorrectDetections.length}`);
        
        if (correctDetections.length > 0) {
          console.log(`   Correct detections: ${correctDetections.join(', ')}`);
        }
        if (incorrectDetections.length > 0) {
          console.log(`   Incorrect generic: ${incorrectDetections.join(', ')}`);
        }

        // Show some examples of what was detected
        const topMentions = mentions
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 5);
        
        console.log('\n🔍 Top 5 detections:');
        topMentions.forEach((mention, idx) => {
          const status = allExpected.some(exp => 
            exp.toLowerCase().includes(mention.name.toLowerCase()) || 
            mention.name.toLowerCase().includes(exp.toLowerCase())
          ) ? '✅' : (avoidWords.some(avoid => avoid.toLowerCase() === mention.name.toLowerCase()) ? '❌' : '❓');
          console.log(`   ${idx+1}. ${status} ${mention.name} (${(mention.confidence*100).toFixed(0)}%) - ${mention.category || 'Unknown'}`);
        });

        allResults.push({
          testCase: testCase.name,
          detected: mentions.length,
          correct: correctDetections.length,
          expected: allExpected.length,
          incorrect: incorrectDetections.length,
          precision: mentions.length > 0 ? correctDetections.length / mentions.length : 0,
          recall: allExpected.length > 0 ? correctDetections.length / allExpected.length : 0
        });

      } else {
        console.log('❌ No mentions detected');
        totalExpected += (testCase.expected.brands?.length || 0) + (testCase.expected.products?.length || 0);
        
        allResults.push({
          testCase: testCase.name,
          detected: 0,
          correct: 0,
          expected: (testCase.expected.brands?.length || 0) + (testCase.expected.products?.length || 0),
          incorrect: 0,
          precision: 0,
          recall: 0
        });
      }

    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
    }

    console.log('\n');
  }

  // Overall results
  console.log('📈 OVERALL PERFORMANCE ANALYSIS');
  console.log('=' .repeat(80));
  
  const overallPrecision = totalCorrect / Math.max(totalCorrect + totalIncorrect, 1);
  const overallRecall = totalCorrect / Math.max(totalExpected, 1);
  const f1Score = (2 * overallPrecision * overallRecall) / Math.max(overallPrecision + overallRecall, 1);

  console.log(`📊 Total Expected: ${totalExpected} brands/products`);
  console.log(`✅ Total Correct: ${totalCorrect}`);
  console.log(`❌ Total Incorrect Generic: ${totalIncorrect}`);
  console.log(`📈 Overall Precision: ${(overallPrecision * 100).toFixed(1)}%`);
  console.log(`📈 Overall Recall: ${(overallRecall * 100).toFixed(1)}%`);
  console.log(`📈 F1 Score: ${(f1Score * 100).toFixed(1)}%`);

  // Performance by test case
  console.log('\n📋 PERFORMANCE BY TEST CASE:');
  allResults.forEach((result, idx) => {
    const f1 = result.precision + result.recall > 0 ? 
      (2 * result.precision * result.recall) / (result.precision + result.recall) : 0;
    console.log(`${idx+1}. ${result.testCase}`);
    console.log(`   Precision: ${(result.precision * 100).toFixed(1)}% | Recall: ${(result.recall * 100).toFixed(1)}% | F1: ${(f1 * 100).toFixed(1)}%`);
  });

  // Recommendations
  console.log('\n💡 PERFORMANCE INSIGHTS:');
  const avgPrecision = allResults.reduce((sum, r) => sum + r.precision, 0) / allResults.length;
  const avgRecall = allResults.reduce((sum, r) => sum + r.recall, 0) / allResults.length;

  if (avgPrecision < 0.8) {
    console.log('⚠️  Precision could be improved - too many false positives');
  }
  if (avgRecall < 0.8) {
    console.log('⚠️  Recall could be improved - missing legitimate brands');
  }
  if (totalIncorrect > 0) {
    console.log('⚠️  Generic words being incorrectly tagged - need better context awareness');
  }
  if (avgPrecision > 0.9 && avgRecall > 0.9 && totalIncorrect === 0) {
    console.log('🎯 Excellent performance across all test cases!');
  }

  console.log('\n🏁 COMPREHENSIVE TEST COMPLETED');
  return { overallPrecision, overallRecall, f1Score, totalIncorrect };
}

// Run the test
runComprehensiveTest().catch(error => {
  console.error('❌ Comprehensive test failed:', error.message);
  process.exit(1);
});