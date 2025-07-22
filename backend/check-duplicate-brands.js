#!/usr/bin/env node

process.env.NODE_ENV = 'development';
process.env.SECRETS_PROVIDER = 'aws';  
process.env.DATABASE_SECRET_NAME = 'serplexity-db';
process.env.AWS_ACCESS_KEY_ID = 'AKIAVFIWIQECD5NKMCUX';
process.env.AWS_SECRET_ACCESS_KEY = '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';
process.env.AWS_REGION = 'us-east-2';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDuplicateBrands() {
  try {
    console.log('🔍 DUPLICATE BRAND ANALYSIS');
    console.log('=' .repeat(60));

    // Get Nordstrom company
    const company = await prisma.company.findFirst({
      where: { name: { contains: 'Nordstrom', mode: 'insensitive' } },
      include: { competitors: true }
    });

    if (!company) {
      console.log('❌ Company not found');
      return;
    }

    console.log(`🏢 Company: ${company.name}`);
    console.log(`🏪 Total competitors: ${company.competitors.length}`);

    // Look for duplicate brand entries
    console.log('\n🔍 Checking for duplicate brand entries...');
    
    const competitors = company.competitors;
    const brandNames = {};
    
    competitors.forEach(comp => {
      const normalizedName = comp.name.toLowerCase().trim();
      if (!brandNames[normalizedName]) {
        brandNames[normalizedName] = [];
      }
      brandNames[normalizedName].push(comp);
    });

    // Find duplicates
    let duplicatesFound = 0;
    for (const [normalizedName, entries] of Object.entries(brandNames)) {
      if (entries.length > 1) {
        duplicatesFound++;
        console.log(`\n❗ DUPLICATE: "${normalizedName}" (${entries.length} entries)`);
        entries.forEach((entry, i) => {
          console.log(`  ${i+1}. ID: ${entry.id}, Name: "${entry.name}", Generated: ${entry.isGenerated}`);
          console.log(`     Website: ${entry.website}`);
        });
      }
    }

    // Check for company name appearing as competitor
    const companyAsCompetitor = competitors.filter(comp => 
      comp.name.toLowerCase().includes(company.name.toLowerCase()) ||
      company.name.toLowerCase().includes(comp.name.toLowerCase())
    );

    if (companyAsCompetitor.length > 0) {
      console.log(`\n🚨 COMPANY AS COMPETITOR: Found ${companyAsCompetitor.length} entries where company appears as competitor:`);
      companyAsCompetitor.forEach((entry, i) => {
        console.log(`  ${i+1}. "${entry.name}" (ID: ${entry.id})`);
      });
    }

    // Summary
    console.log(`\n📊 SUMMARY:`);
    console.log(`  • Total competitors: ${competitors.length}`);
    console.log(`  • Duplicate sets found: ${duplicatesFound}`);
    console.log(`  • Company-as-competitor entries: ${companyAsCompetitor.length}`);
    
    if (duplicatesFound === 0 && companyAsCompetitor.length === 0) {
      console.log('✅ No duplicates found - issue may be elsewhere');
    } else {
      console.log('⚠️  Duplicates detected - this could cause dashboard display issues');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicateBrands();