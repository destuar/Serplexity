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
          take: 1
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
        const response = run.responses[0];
        console.log(`  Sample response length: ${response.content?.length || 0} chars`);
        console.log(`  Model: ${response.model}`);
        
        // Check for brand tags in response
        const brandMatches = (response.content || '').match(/<brand>(.*?)<\/brand>/gi);
        console.log(`  Brand tags found: ${brandMatches?.length || 0}`);
        if (brandMatches && brandMatches.length > 0) {
          console.log(`  Brands: ${brandMatches.slice(0, 3).join(', ')}`);
        }
        
        // Show actual response content to debug
        console.log(`  Response content preview:`);
        console.log(`    "${(response.content || '').substring(0, 500)}..."`);
        
        // Look for any mentions of company names that should have been tagged
        const companyPatterns = ['Apple', 'Microsoft', 'Google', 'Amazon', 'Meta', 'Tesla', 'Adobe', 'Salesforce'];
        const foundCompanies = companyPatterns.filter(company => 
          (response.content || '').toLowerCase().includes(company.toLowerCase())
        );
        if (foundCompanies.length > 0) {
          console.log(`  Untagged companies found: ${foundCompanies.join(', ')}`);
        }
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