import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Checking for existing companies...');
    
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        website: true
      },
      take: 5
    });
    
    if (companies.length === 0) {
      console.log('❌ No companies found in database');
      console.log('💡 You may need to create a test company first');
    } else {
      console.log(`✅ Found ${companies.length} companies:`);
      companies.forEach(company => {
        console.log(`   - ID: ${company.id}, Name: ${company.name}, Website: ${company.website}`);
      });
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
