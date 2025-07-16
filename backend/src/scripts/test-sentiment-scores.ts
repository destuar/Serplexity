#!/usr/bin/env ts-node

import { getDbClient } from '../config/database';

async function testSentimentScores(): Promise<void> {
  const prisma = await getDbClient();
  console.log('🧪 Testing SentimentScore model...\n');

  try {
    // Count total sentiment scores
    const totalScores = await prisma.sentimentScore.count();
    console.log(`📊 Total sentiment scores: ${totalScores}`);

    // Get recent sentiment scores
    const recentScores = await prisma.sentimentScore.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      include: {
        reportRun: {
          include: {
            company: { select: { name: true } }
          }
        }
      }
    });

    console.log('\n🔍 Recent sentiment scores:');
    recentScores.forEach((score, index) => {
      const company = score.reportRun.company.name;
      const engine = score.engine || 'unknown';
      const createdAt = score.createdAt.toISOString().split('T')[0];
      
      console.log(`   ${index + 1}. ${company} - ${engine} (${createdAt})`);
      console.log(`      📝 Name: ${score.name}`);
      
      // Try to parse and show a snippet of the JSON value
      try {
        const value = typeof score.value === 'string' ? JSON.parse(score.value) : score.value;
        const keys = Object.keys(value || {});
        console.log(`      🔧 Data keys: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}`);
      } catch (e) {
        console.log(`      🔧 Data: [${typeof score.value}]`);
      }
    });

    // Group by engine
    console.log('\n🤖 Sentiment scores by engine:');
    const engineGroups = await prisma.sentimentScore.groupBy({
      by: ['engine'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    });

    engineGroups.forEach(({ engine, _count }) => {
      console.log(`   ✅ ${engine || 'null'}: ${_count.id} scores`);
    });

    console.log('\n✅ SentimentScore model is working correctly!');

  } catch (error) {
    console.error('❌ Error testing SentimentScore model:', error);
    throw error;
  }
}

async function main(): Promise<void> {
  const prisma = await getDbClient();
  try {
    await testSentimentScores();
    
  } catch (error) {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
    
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}

export { testSentimentScores }; 