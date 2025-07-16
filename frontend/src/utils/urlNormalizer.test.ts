/**
 * @file urlNormalizer.test.ts
 * @description Test suite for URL normalization utilities.
 * Provides comprehensive testing for URL processing and validation functions.
 *
 * @dependencies
 * - jest: For testing framework.
 * - ./urlNormalizer: For the functions being tested.
 *
 * @exports
 * - Test suite for URL normalization functionality.
 */
import { normalizeUrl } from './urlNormalizer';

// Test cases for URL normalization
const testCases = [
  // Basic domain
  { input: 'example.com', expected: 'https://www.example.com' },
  
  // With www
  { input: 'www.example.com', expected: 'https://www.example.com' },
  
  // With http
  { input: 'http://example.com', expected: 'https://www.example.com' },
  
  // With https
  { input: 'https://example.com', expected: 'https://www.example.com' },
  
  // With https and www
  { input: 'https://www.example.com', expected: 'https://www.example.com' },
  
  // With subdomain
  { input: 'blog.example.com', expected: 'https://www.blog.example.com' },
  
  // With path
  { input: 'example.com/path', expected: 'https://www.example.com/path' },
  
  // With query params
  { input: 'example.com?param=value', expected: 'https://www.example.com?param=value' },
  
  // Edge cases
  { input: '', expected: '' },
  { input: '   example.com   ', expected: 'https://www.example.com' },
];

// Manual testing function (can be run in browser console)
export const testUrlNormalizer = () => {
  console.log('Testing URL Normalizer:');
  
  testCases.forEach(({ input, expected }, index) => {
    const result = normalizeUrl(input);
    const passed = result === expected;
    
    console.log(`Test ${index + 1}: ${passed ? '✅' : '❌'}`);
    console.log(`  Input: "${input}"`);
    console.log(`  Expected: "${expected}"`);
    console.log(`  Got: "${result}"`);
    if (!passed) {
      console.log(`  ❌ FAILED`);
    }
    console.log('');
  });
};

// Export for potential use in actual test runners
export { testCases };