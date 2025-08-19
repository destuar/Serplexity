/**
 * Timezone Component Validation Test
 * Run this in browser console to validate timezone calculations
 */

// Test critical timezone calculations
const testTimezones = [
  { tz: 'America/Los_Angeles', expected: 'UTC-8' }, // PST
  { tz: 'America/New_York', expected: 'UTC-5' },    // EST  
  { tz: 'Europe/London', expected: 'UTC+0' },       // GMT
  { tz: 'Asia/Tokyo', expected: 'UTC+9' },          // JST
  { tz: 'Asia/Kathmandu', expected: 'UTC+5:45' },   // Half-hour offset
  { tz: 'Asia/Colombo', expected: 'UTC+5:30' },     // Half-hour offset
  { tz: 'Australia/Adelaide', expected: 'UTC+10:30' }, // Half-hour offset
  { tz: 'Pacific/Chatham', expected: 'UTC+12:45' }, // 45-min offset
  { tz: 'UTC', expected: 'UTC+0' }
];

console.log('🚀 Testing Timezone Component Calculations...\n');

const testTimezoneOffset = (tz) => {
  try {
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      timeZoneName: 'longOffset'
    });
    
    const parts = formatter.formatToParts(new Date());
    const offsetPart = parts.find(part => part.type === 'timeZoneName');
    
    if (offsetPart?.value) {
      return offsetPart.value.replace('GMT', 'UTC');
    }
    return 'ERROR';
  } catch {
    return 'INVALID';
  }
};

let passed = 0;
let failed = 0;

testTimezones.forEach(({ tz, expected }) => {
  const result = testTimezoneOffset(tz);
  const isCorrect = result === expected || 
    (tz === 'America/Los_Angeles' && (result === 'UTC-8' || result === 'UTC-7')) || // DST
    (tz === 'America/New_York' && (result === 'UTC-5' || result === 'UTC-4')) ||   // DST
    (tz === 'Europe/London' && (result === 'UTC+0' || result === 'UTC+1'));       // BST
  
  if (isCorrect) {
    console.log(`✅ ${tz}: ${result} (expected ${expected})`);
    passed++;
  } else {
    console.log(`❌ ${tz}: ${result} (expected ${expected})`);
    failed++;
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

// Test performance
console.log('\n⚡ Performance Test...');
const start = performance.now();
for (let i = 0; i < 1000; i++) {
  testTimezoneOffset('America/Los_Angeles');
}
const end = performance.now();
console.log(`1000 calculations took ${(end - start).toFixed(2)}ms`);

// Test validation
console.log('\n🔍 Validation Test...');
const validTimezones = ['America/Los_Angeles', 'Europe/London', 'Asia/Tokyo'];
const invalidTimezones = ['Invalid/Timezone', 'America/FakeCity', 'NotReal'];

validTimezones.forEach(tz => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    console.log(`✅ ${tz}: Valid`);
  } catch {
    console.log(`❌ ${tz}: Should be valid but failed`);
  }
});

invalidTimezones.forEach(tz => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    console.log(`❌ ${tz}: Should be invalid but passed`);
  } catch {
    console.log(`✅ ${tz}: Correctly identified as invalid`);
  }
});

console.log('\n🎯 All tests completed!');