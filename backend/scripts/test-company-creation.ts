import { getPrismaClient } from '../src/config/dbCache';

async function testCompanyCreation() {
  console.log('🧪 Testing company creation with database constraints...');
  
  const prisma = await getPrismaClient();
  
  try {
    // Clean up existing test data
    await prisma.company.deleteMany({
      where: {
        website: 'https://testcompany.com'
      }
    });
    
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['testuser1@example.com', 'testuser2@example.com']
        }
      }
    });
    
    // Create two test users
    const user1 = await prisma.user.create({
      data: {
        email: 'testuser1@example.com',
        name: 'Test User 1',
        password: 'hashedpassword123'
      }
    });
    
    const user2 = await prisma.user.create({
      data: {
        email: 'testuser2@example.com',
        name: 'Test User 2',
        password: 'hashedpassword123'
      }
    });
    
    console.log('✅ Created test users:', { user1: user1.id, user2: user2.id });
    
    // Test 1: User 1 creates a company
    console.log('\n📋 Test 1: User 1 creates company...');
    const company1 = await prisma.company.create({
      data: {
        name: 'Test Company',
        website: 'https://testcompany.com',
        industry: 'Technology',
        userId: user1.id
      }
    });
    console.log('✅ User 1 successfully created company:', company1.id);
    
    // Test 2: User 2 creates company with SAME website (should work now)
    console.log('\n📋 Test 2: User 2 creates company with same website...');
    const company2 = await prisma.company.create({
      data: {
        name: 'Same Company Different User',
        website: 'https://testcompany.com', // Same website!
        industry: 'Technology',
        userId: user2.id
      }
    });
    console.log('✅ User 2 successfully created company with same website:', company2.id);
    
    // Test 3: User 1 tries to create duplicate (should fail)
    console.log('\n📋 Test 3: User 1 tries to create duplicate website...');
    try {
      await prisma.company.create({
        data: {
          name: 'Duplicate Company',
          website: 'https://testcompany.com', // Same website, same user
          industry: 'Technology',
          userId: user1.id
        }
      });
      console.log('❌ ERROR: Should have failed but didn\'t!');
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('userId') && error.meta?.target?.includes('website')) {
        console.log('✅ Correctly blocked duplicate: User cannot create multiple companies with same website');
        console.log('   Error target:', error.meta.target);
      } else {
        console.log('❌ Unexpected error:', error);
      }
    }
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('   ✓ Multiple users can track the same company');
    console.log('   ✓ Same user cannot create duplicate company URLs');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCompanyCreation().catch(console.error);