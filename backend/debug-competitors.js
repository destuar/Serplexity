#!/usr/bin/env node

// Set up environment for AWS secrets
process.env.NODE_ENV = 'development';
process.env.SECRETS_PROVIDER = 'aws';
process.env.DATABASE_SECRET_NAME = 'serplexity-db';
process.env.AWS_ACCESS_KEY_ID = 'AKIAVFIWIQECD5NKMCUX';
process.env.AWS_SECRET_ACCESS_KEY = '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';
process.env.AWS_REGION = 'us-east-2';

const { getDbClient } = require('./dist/config/database');

(async () => {
  try {
    console.log('🔍 Connecting to database via AWS secrets...');
    const prisma = await getDbClient();
    
    console.log('📊 Recent Report Runs:');
    const runs = await prisma.reportRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: {
        company: { select: { name: true } },
        responses: { 
          select: { 
            id: true, 
            content: true,
            model: true 
          },
          take: 3  // Get more responses to check
        }
      }
    });
    
    for (const run of runs) {
      console.log(`\nRun ${run.id} (${run.company.name}):`);
      console.log(`  Status: ${run.status}`);
      console.log(`  Step: ${run.stepStatus}`);
      console.log(`  Created: ${run.createdAt.toISOString()}`);
      console.log(`  Responses: ${run.responses.length}`);
      
      if (run.responses.length > 0) {
        run.responses.forEach((response, index) => {
          console.log(`\n  Response ${index + 1}:`);
          console.log(`    Length: ${response.content?.length || 0} chars`);
          console.log(`    Model: ${response.model}`);
          
          // Check for brand tags in response
          const brandMatches = (response.content || '').match(/<brand>(.*?)<\/brand>/gi);
          console.log(`    Brand tags found: ${brandMatches?.length || 0}`);
          if (brandMatches && brandMatches.length > 0) {
            console.log(`    Tagged brands: ${brandMatches.slice(0, 5).join(', ')}`);
          }
          
          // Look for any mentions of company names that should have been tagged
          const companyPatterns = ['Apple', 'Microsoft', 'Google', 'Amazon', 'Meta', 'Tesla', 'Adobe', 'Salesforce', 'Netflix', 'Uber', 'Airbnb', 'Spotify'];
          const foundCompanies = companyPatterns.filter(company => 
            (response.content || '').toLowerCase().includes(company.toLowerCase())
          );
          if (foundCompanies.length > 0) {
            console.log(`    Untagged companies detected: ${foundCompanies.join(', ')}`);
          }
          
          // Show response preview if it contains untagged companies or is very short
          if (response.content && (foundCompanies.length > 0 || response.content.length < 800)) {
            console.log(`    Content preview: "${response.content.substring(0, 600)}..."`);
          }
        });
      }
    }
    
    console.log(`\n🏢 Total Competitors in Database:`);
    const totalCompetitors = await prisma.competitor.count();
    console.log(`  Total: ${totalCompetitors}`);
    
    if (totalCompetitors > 0) {
      console.log(`\n📈 Recent Competitors:`);
      const competitors = await prisma.competitor.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { company: { select: { name: true } } }
      });
      
      for (const comp of competitors) {
        console.log(`  - ${comp.name} (${comp.company.name}) - ${comp.isGenerated ? 'AI Generated' : 'Manual'} - ${comp.createdAt.toISOString()}`);
      }
    } else {
      console.log('  No competitors found in database');
    }
    
    await prisma.$disconnect();
    console.log('✅ Database query completed');
  } catch (error) {
    console.error('❌ Database query failed:', error.message);
    process.exit(1);
  }
})();