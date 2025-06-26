#!/usr/bin/env ts-node

/**
 * Enhanced Mention Detection Test Suite
 * Tests the improved mention identification system with various edge cases
 */

interface TestEntity {
    id: string;
    name: string;
    aliases?: string[];
}

// Test data representing common real-world scenarios
const TEST_ENTITIES: TestEntity[] = [
    { id: 'apple', name: 'Apple Inc.' },
    { id: 'microsoft', name: 'Microsoft Corporation' },
    { id: 'google', name: 'Google LLC' },
    { id: 'amazon', name: 'Amazon.com, Inc.' },
    { id: 'tesla', name: 'Tesla, Inc.' },
    { id: 'facebook', name: 'Meta Platforms, Inc.' },
    { id: 'jpmorgan', name: 'JPMorgan Chase & Co.' },
    { id: 'general-electric', name: 'General Electric Company', aliases: ['GE'] },
    { id: 'ibm', name: 'International Business Machines Corporation', aliases: ['IBM'] },
    { id: 'visa', name: 'Visa Inc.' }
];

const TEST_CASES = [
    {
        name: "Basic Company Mentions",
        text: "Apple is a great company. Microsoft and Google are also good choices.",
        expectedMentions: ['apple', 'microsoft', 'google']
    },
    {
        name: "Corporate Suffix Variations",
        text: "I work at Apple Inc and my friend works at Microsoft Corporation.",
        expectedMentions: ['apple', 'microsoft']
    },
    {
        name: "Punctuation and Context",
        text: "Companies like Apple, Microsoft, and Google dominate the tech industry.",
        expectedMentions: ['apple', 'microsoft', 'google']
    },
    {
        name: "Acronym Recognition",
        text: "IBM and GE are traditional companies, while newer ones include Tesla.",
        expectedMentions: ['ibm', 'general-electric', 'tesla']
    },
    {
        name: "Quoted Company Names",
        text: 'I invested in "Apple" and "Tesla" last year.',
        expectedMentions: ['apple', 'tesla']
    }
];

// Helper functions
function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function generateComprehensiveNameVariations(entity: TestEntity): Set<string> {
    const variations = new Set<string>();
    const { name, aliases } = entity;
    
    // Add the original name
    variations.add(name);

    // Add all provided aliases
    if (aliases) {
        aliases.forEach(alias => variations.add(alias));
    }
    
    // Add variations without common suffixes
    const suffixes = ['Inc.', 'Inc', 'Corporation', 'Corp.', 'Corp', 'LLC', 'Ltd.', 'Ltd', 'Company', 'Co.', 'Co'];
    let baseName = name;
    
    for (const suffix of suffixes) {
        if (baseName.endsWith(suffix)) {
            baseName = baseName.replace(new RegExp(`\\s*${escapeRegex(suffix)}$`), '').trim();
            variations.add(baseName);
            break;
        }
    }
    
    // Add variations with different punctuation
    variations.add(baseName.replace(/[.,&]/g, ''));
    variations.add(baseName.replace(/&/g, 'and'));
    variations.add(baseName.replace(/and/g, '&'));
    
    return variations;
}

interface MentionResult {
    id: string;
    position: number;
    isCompany: boolean;
    confidence: number;
}

function findMentions(text: string, entities: typeof TEST_ENTITIES, companyId?: string): MentionResult[] {
    const allPossibleMentions: MentionResult[] = [];
    
    for (const entity of entities) {
        if (!entity.name || entity.name.length < 2) continue;
        
        const variations = generateComprehensiveNameVariations(entity);
        
        for (const variation of variations) {
            const trimmedVariation = variation.trim();
            if (trimmedVariation.length < 2) continue;
            
            try {
                // Enhanced regex patterns for different contexts with confidence scoring
                const patterns = [
                    { pattern: `\\b${escapeRegex(trimmedVariation)}\\b`, confidence: 1.0 },
                    { pattern: `${escapeRegex(trimmedVariation)}(?=[.,;:!?\\s])`, confidence: 0.9 },
                ];
                
                for (const { pattern, confidence } of patterns) {
                    const regex = new RegExp(pattern, 'gi');
                    let match;
                    
                    while ((match = regex.exec(text)) !== null) {
                        allPossibleMentions.push({
                            id: entity.id,
                            position: match.index,
                            isCompany: entity.id === companyId,
                            confidence: confidence
                        });
                    }
                }
            } catch (error) {
                console.warn(`Invalid regex for variation: ${trimmedVariation}`, error);
            }
        }
    }
    
    // Remove duplicates and return sorted by position
    const uniqueMentions = Array.from(
        new Map(allPossibleMentions.map(m => [`${m.id}-${m.position}`, m])).values()
    );
    
    return uniqueMentions.sort((a, b) => a.position - b.position);
}

// Test runner
export function runTests(): { totalTests: number, passedTests: number, failedTests: any[] } {
    console.log('🧪 Enhanced Mention Detection Test Suite');
    console.log('==========================================\n');
    
    let totalTests = 0;
    let passedTests = 0;
    let failedTests: any[] = [];
    
    for (const testCase of TEST_CASES) {
        totalTests++;
        console.log(`🔍 Testing: ${testCase.name}`);
        console.log(`   Text: "${testCase.text}"`);
        
        const mentions = findMentions(testCase.text, TEST_ENTITIES);
        const actualIds = mentions.map(m => m.id).sort();
        const expectedIds = testCase.expectedMentions.sort();
        
        const passed = JSON.stringify(actualIds) === JSON.stringify(expectedIds);
        
        if (passed) {
            passedTests++;
            console.log(`   ✅ PASS: Found ${mentions.length} mentions`);
        } else {
            console.log(`   ❌ FAIL: Expected ${expectedIds.join(', ')}, got ${actualIds.join(', ')}`);
            failedTests.push({
                name: testCase.name,
                expected: expectedIds,
                actual: actualIds,
                text: testCase.text
            });
        }
        
        console.log('');
    }
    
    // Summary
    console.log('\n📊 Test Results Summary');
    console.log('=======================');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} (${Math.round(passedTests / totalTests * 100)}%)`);
    console.log(`Failed: ${failedTests.length} (${Math.round(failedTests.length / totalTests * 100)}%)`);
    
    if (failedTests.length > 0) {
        console.log('\n❌ Failed Test Details:');
        for (const failed of failedTests) {
            console.log(`\n  Test: ${failed.name}`);
            console.log(`  Expected: [${failed.expected.join(', ')}]`);
            console.log(`  Actual:   [${failed.actual.join(', ')}]`);
        }
    }
    
    console.log('\n✨ Enhanced mention detection analysis complete!');
    return { totalTests, passedTests, failedTests };
}

// Run the tests if this script is executed directly
if (require.main === module) {
    runTests();
}

export { TEST_ENTITIES, TEST_CASES, findMentions, generateComprehensiveNameVariations }; 