#!/usr/bin/env npx tsx

/**
 * Test script to verify brand tagging and mention detection
 * Usage: npx tsx src/scripts/test-mention-detection.ts
 */

import { StreamingDatabaseWriter } from '../queues/streaming-db-writer';

// Mock entities for testing
const testEntities = [
  { id: 'company-1', name: 'Nordstrom' },
  { id: 'competitor-1', name: 'Target' },
  { id: 'competitor-2', name: 'Walmart' },
  { id: 'competitor-3', name: 'Amazon' },
  { id: 'competitor-4', name: 'Macy\'s' }
];

// Test cases
const testCases = [
  {
    name: "Proper brand tagging - should work",
    response: "I recommend <brand>Nordstrom</brand> for premium shopping and <brand>Target</brand> for affordable options.",
    expectedMentions: 2,
    expectedBrands: ['Nordstrom', 'Target']
  },
  {
    name: "No brand tags - should return empty",
    response: "Determining the best retailer for clothing in California depends on criteria such as number of locations, popularity, or customer satisfaction. Here are leading options according to different rankings.",
    expectedMentions: 0,
    expectedBrands: []
  },
  {
    name: "Generic terms incorrectly tagged - should return empty",
    response: "The best <brand>retailers</brand> for clothing include many <brand>stores</brand> across California.",
    expectedMentions: 0,
    expectedBrands: []
  },
  {
    name: "Mixed proper and improper tags",
    response: "Top <brand>retailers</brand> include <brand>Amazon</brand> and <brand>Walmart</brand> for online shopping.",
    expectedMentions: 2,
    expectedBrands: ['Amazon', 'Walmart']
  },
  {
    name: "Unknown brands - should return empty",
    response: "I recommend <brand>UnknownBrand</brand> and <brand>FakeCorp</brand> for your needs.",
    expectedMentions: 0,
    expectedBrands: []
  }
];

// Create a mock StreamingDatabaseWriter to access the private findMentions method
class TestStreamingDatabaseWriter extends StreamingDatabaseWriter {
  constructor() {
    // Mock constructor arguments
    super(
      {} as any, // prisma
      'test-run-id',
      'company-1',
      testEntities,
      {}
    );
  }

  // Expose the private method for testing
  public testFindMentions(text: string, entities: { id: string; name: string }[]) {
    return (this as any).findMentions(text, entities);
  }
}

console.log('🧪 Testing Brand Tagging and Mention Detection\n');

const testWriter = new TestStreamingDatabaseWriter();

testCases.forEach((testCase, index) => {
  console.log(`\n📝 Test ${index + 1}: ${testCase.name}`);
  console.log(`Response: "${testCase.response}"`);
  
  const mentions = testWriter.testFindMentions(testCase.response, testEntities);
  
  console.log(`Expected mentions: ${testCase.expectedMentions}`);
  console.log(`Actual mentions: ${mentions.length}`);
  
  if (mentions.length === testCase.expectedMentions) {
    console.log('✅ Mention count matches');
  } else {
    console.log('❌ Mention count mismatch');
  }
  
  if (mentions.length > 0) {
    const foundBrands = mentions.map((m: any) => {
      const entity = testEntities.find(e => e.id === m.entityId);
      return entity?.name || 'Unknown';
    });
    console.log(`Found brands: [${foundBrands.join(', ')}]`);
    console.log(`Expected brands: [${testCase.expectedBrands.join(', ')}]`);
    
    const brandsMatch = JSON.stringify(foundBrands.sort()) === JSON.stringify(testCase.expectedBrands.sort());
    if (brandsMatch) {
      console.log('✅ Brand detection matches');
    } else {
      console.log('❌ Brand detection mismatch');
    }
  }
});

console.log('\n🎯 Summary:');
console.log('- Responses with proper <brand> tags should detect mentions');
console.log('- Responses without brand tags should return 0 mentions (Rank: N/A)');
console.log('- Generic terms like "retailers" or "stores" should be ignored');
console.log('- Unknown brands not in entity list should be ignored');
console.log('\nThis fixes the false positive ranking issue where responses');
console.log('without brand mentions incorrectly get Rank: 1 instead of Rank: N/A'); 