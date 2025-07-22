#!/usr/bin/env node

process.env.NODE_ENV = 'development';
process.env.SECRETS_PROVIDER = 'aws';
process.env.DATABASE_SECRET_NAME = 'serplexity-db';
process.env.AWS_ACCESS_KEY_ID = 'AKIAVFIWIQECD5NKMCUX';
process.env.AWS_SECRET_ACCESS_KEY = '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';
process.env.AWS_REGION = 'us-east-2';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCompetitors() {
  try {
    const company = await prisma.company.findFirst({
      where: { name: { contains: 'Cedars-Sinai', mode: 'insensitive' } },
      include: { competitors: true }
    });
    
    if (!company) {
      console.log('❌ Company not found');
      return;
    }
    
    console.log('🏢 Company:', company.name);
    console.log('🔍 Competitors in database:');
    company.competitors.forEach((comp, i) => {
      console.log(`  ${i+1}. ${comp.name} (ID: ${comp.id})`);
    });
    
    // Check mentions for recent responses
    const recentMentions = await prisma.mention.findMany({
      where: {
        OR: [
          { companyId: company.id },
          { competitorId: { in: company.competitors.map(c => c.id) } }
        ]
      },
      include: {
        company: true,
        competitor: true,
        response: {
          include: {
            question: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    console.log(`\n📊 Recent mentions (${recentMentions.length}):`);
    recentMentions.forEach((mention, i) => {
      const entity = mention.company ? mention.company.name : mention.competitor?.name || 'Unknown';
      const type = mention.company ? 'Company' : 'Competitor';
      console.log(`  ${i+1}. ${entity} (${type}) - Position ${mention.position}`);
      console.log(`     Question: ${mention.response.question.query.substring(0, 60)}...`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkCompetitors();