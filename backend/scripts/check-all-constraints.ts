import { getPrismaClient } from '../src/config/dbCache';

async function checkAllConstraints() {
  console.log('🔍 Checking ALL constraints on Company table...');
  
  const prisma = await getPrismaClient();
  
  try {
    // Get all constraints (not just unique ones)
    const allConstraints = await prisma.$queryRaw`
      SELECT 
        conname as constraint_name,
        contype as constraint_type,
        pg_get_constraintdef(c.oid) as constraint_definition,
        conkey as column_indexes
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE t.relname = 'Company'
      AND n.nspname = 'public'
      ORDER BY contype, conname
    `;
    
    console.log('📋 ALL constraints on Company table:');
    console.table(allConstraints);
    
    // Check specifically for ANY constraint involving website column
    const websiteConstraints = await prisma.$queryRaw`
      SELECT 
        conname,
        contype,
        pg_get_constraintdef(c.oid) as definition,
        a.attname as column_name
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
      WHERE t.relname = 'Company'
      AND a.attname = 'website'
    `;
    
    console.log('🌐 ALL constraints involving "website" column:');
    console.table(websiteConstraints);
    
    // Also check indexes
    const indexes = await prisma.$queryRaw`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'Company'
      AND schemaname = 'public'
      ORDER BY indexname
    `;
    
    console.log('📊 All indexes on Company table:');
    console.table(indexes);
    
  } catch (error) {
    console.error('❌ Error checking constraints:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllConstraints().catch(console.error);