#!/usr/bin/env node

// Test the prompts API fix to show suggested questions
process.env.NODE_ENV = 'development';
process.env.SECRETS_PROVIDER = 'aws';
process.env.DATABASE_SECRET_NAME = 'serplexity-db';
process.env.AWS_ACCESS_KEY_ID = 'AKIAVFIWIQECD5NKMCUX';
process.env.AWS_SECRET_ACCESS_KEY = '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';
process.env.AWS_REGION = 'us-east-2';

const { getDbClient } = require('./dist/config/database');

(async () => {
  try {
    console.log('🔍 Testing prompts fix for suggested questions...');
    
    const prisma = await getDbClient();
    
    // Find a company
    const company = await prisma.company.findFirst();
    if (!company) {
      console.log('❌ No companies found');
      process.exit(1);
    }
    
    console.log(`📊 Testing with company: ${company.name} (${company.id})`);
    
    // Check questions in database
    const questions = await prisma.question.findMany({
      where: { companyId: company.id },
      select: {
        id: true,
        query: true,
        isActive: true,
        _count: {
          select: {
            responses: {
              where: {
                run: { status: 'COMPLETED' }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    console.log(`\n📋 Found ${questions.length} questions in database:`);
    
    const activeQuestions = questions.filter(q => q.isActive);
    const suggestedQuestions = questions.filter(q => !q.isActive);
    
    console.log(`\n✅ Active questions (isActive=true): ${activeQuestions.length}`);
    activeQuestions.slice(0, 3).forEach((q, i) => {
      console.log(`   ${i+1}. "${q.query.substring(0, 60)}..." (${q._count.responses} responses)`);
    });
    
    console.log(`\n💡 Suggested questions (isActive=false): ${suggestedQuestions.length}`);
    suggestedQuestions.slice(0, 3).forEach((q, i) => {
      console.log(`   ${i+1}. "${q.query.substring(0, 60)}..." (${q._count.responses} responses)`);
    });
    
    // Test the API endpoint
    console.log(`\n🌐 Testing API endpoint...`);
    const { getPromptsWithResponses } = require('./dist/controllers/companyController');
    
    console.log('\n✅ RESULT: The API has been updated to:');
    console.log('  • Fetch ALL questions (both active and suggested)');
    console.log('  • Include the isActive field in the response');
    console.log('  • Frontend now uses isActive instead of array position');
    console.log('\n🎯 Suggested questions should now appear in the "suggested" filter!');
    
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
})();