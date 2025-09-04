import { getPrismaClient } from '../src/config/dbCache';

async function checkConstraints() {
  console.log('🔍 Checking Company table constraints...');
  
  const prisma = await getPrismaClient();
  
  try {
    const constraints = await prisma.$queryRaw`
      SELECT 
        conname as constraint_name,
        contype as constraint_type,
        pg_get_constraintdef(c.oid) as constraint_definition
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE t.relname = 'Company'
      AND n.nspname = 'public'
      ORDER BY contype, conname
    `;
    
    console.log('📋 Current constraints on Company table:');
    console.table(constraints);
    
    // Check specifically for website unique constraint
    const websiteConstraints = await prisma.$queryRaw`
      SELECT 
        conname,
        pg_get_constraintdef(c.oid) as definition
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'Company'
      AND contype = 'u'
      AND pg_get_constraintdef(c.oid) LIKE '%website%'
    `;
    
    console.log('🌐 Website-related unique constraints:');
    console.table(websiteConstraints);
    
  } catch (error) {
    console.error('❌ Error checking constraints:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkConstraints().catch(console.error);