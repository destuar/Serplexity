#!/usr/bin/env node

// Test the brand mention regex
console.log('🔍 Testing brand mention regex...');

const testRegex = /<brand(?:\s+position="(\d+)")?>([^<]+)<\/brand>/gi;
const sampleTexts = [
  'Here are some retailers: <brand>Macy\'s</brand>, <brand>Saks Fifth Avenue</brand>, and <brand>Bloomingdale\'s</brand>.',
  'Department stores like <brand position="1">Nordstrom</brand> and <brand position="2">Target</brand> are popular.',
  'No brands here, just regular text.'
];

sampleTexts.forEach((text, i) => {
  console.log(`\nSample ${i + 1}: ${text}`);
  
  let match;
  let count = 0;
  const regex = /<brand(?:\s+position="(\d+)")?>([^<]+)<\/brand>/gi;
  
  while ((match = regex.exec(text)) !== null) {
    count++;
    const position = match[1] ? parseInt(match[1]) : count;
    const brandName = match[2].trim();
    console.log(`  Match ${count}: "${brandName}" at position ${position}`);
  }
  
  if (count === 0) {
    console.log(`  No matches found`);
  } else {
    console.log(`  Total matches: ${count}`);
  }
});