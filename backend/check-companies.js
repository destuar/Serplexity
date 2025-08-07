const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        domain: true
      },
      take: 5
    });
    
    if (companies.length === 0) {
      console.log('No companies found in database');
    } else {
      console.log('Available companies:');
      companies.forEach(company => {
        console.log(`- ID: ${company.id}, Name: ${company.name}, Domain: ${company.domain}`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
