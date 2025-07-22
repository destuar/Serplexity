#!/usr/bin/env node

process.env.NODE_ENV = 'development';
process.env.SECRETS_PROVIDER = 'aws';
process.env.DATABASE_SECRET_NAME = 'serplexity-db';
process.env.AWS_ACCESS_KEY_ID = 'AKIAVFIWIQECD5NKMCUX';
process.env.AWS_SECRET_ACCESS_KEY = '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';
process.env.AWS_REGION = 'us-east-2';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMentions() {
  try {
    // Get latest Nordstrom report
    const report = await prisma.reportRun.findFirst({
      where: { 
        company: {
          name: { contains: 'Nordstrom', mode: 'insensitive' }
        }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        company: {
          include: {
            competitors: true
          }
        }
      }
    });
    
    if (!report) {
      console.log('❌ No Nordstrom report found');
      return;
    }
    
    console.log(`🏢 Company: ${report.company.name}`);
    console.log(`📊 Report ID: ${report.id}`);
    console.log(`🏪 Competitors in DB: ${report.company.competitors.length}`);
    
    // List competitors
    if (report.company.competitors.length > 0) {
      console.log('🏪 Competitors:');
      report.company.competitors.forEach((comp, i) => {
        console.log(`  ${i+1}. ${comp.name} (${comp.isGenerated ? 'AI-generated' : 'Manual'})`);
      });
    }
    
    // Check mentions for this report run
    const mentions = await prisma.mention.findMany({
      where: {
        response: {
          reportRunId: report.id
        }
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
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`\n📈 Mentions found: ${mentions.length}`);
    
    if (mentions.length > 0) {
      console.log('\n📋 Mention details:');
      mentions.slice(0, 10).forEach((mention, i) => {
        const entity = mention.company ? mention.company.name : mention.competitor?.name || 'Unknown';
        const type = mention.company ? 'Company' : 'Competitor';
        console.log(`  ${i+1}. ${entity} (${type}) - Position ${mention.position}`);
        console.log(`     Question: ${mention.response.question.query.substring(0, 60)}...`);
      });
    } else {
      console.log('⚠️  No mentions found - checking responses with <brand> tags...');
      
      const responses = await prisma.response.findMany({
        where: { reportRunId: report.id },
        include: { question: true },
        take: 3
      });
      
      console.log(`\n🔍 Sample responses (${responses.length}):`);
      responses.forEach((resp, i) => {
        const brandTags = (resp.answer.match(/<brand>/g) || []).length;
        console.log(`  ${i+1}. ${resp.question.query.substring(0, 50)}...`);
        console.log(`     Brand tags found: ${brandTags}`);
        console.log(`     Answer preview: ${resp.answer.substring(0, 150)}...`);
        
        // Show sample brand tags
        const brandMatches = resp.answer.match(/<brand>([^<]+)<\/brand>/g) || [];
        if (brandMatches.length > 0) {
          console.log(`     Sample brands: ${brandMatches.slice(0, 3).join(', ')}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkMentions();