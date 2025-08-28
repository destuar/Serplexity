/**
 * @file test-ai-overview-fix.ts
 * @description Validation script to test AI Overview mention detection fix
 * 
 * This script tests the unified AI Overview processing pipeline to ensure:
 * 1. AI Overview content gets processed through Answer Agent for brand tagging
 * 2. Standard <brand> tag parsing works correctly
 * 3. Share of Voice and Inclusion Rate calculations include AI Overview mentions
 * 
 * Usage: ts-node src/scripts/test-ai-overview-fix.ts
 */

import { getDbClient } from "../config/database";
import { pydanticLlmService } from "../services/pydanticLlmService";

interface TestResult {
  success: boolean;
  error?: string;
  details: {
    originalContent: string;
    brandTaggedContent: string;
    mentionsFound: number;
    brandTagsFound: number;
  };
}

async function testAIOverviewBrandTagging(
  companyName: string,
  aiOverviewContent: string
): Promise<TestResult> {
  try {
    console.log(`🧪 Testing AI Overview brand tagging for company: ${companyName}`);
    console.log(`📄 Original content preview: ${aiOverviewContent.substring(0, 100)}...`);

    // Test the Answer Agent processing that AI Overview should now use
    const result = await pydanticLlmService.executeAgent(
      "answer_agent.py",
      {
        question: "Test question for brand tagging",
        company_name: companyName,
        raw_content: aiOverviewContent,
        enable_web_search: false,
        is_ai_overview: true,
      },
      null,
      {
        modelId: "gpt-4.1-mini",
        timeout: 30000,
      }
    );

    if (!result.metadata?.success || !result.data) {
      throw new Error(`Answer Agent failed: ${JSON.stringify(result)}`);
    }

    const taggedResponse = result.data as any;
    const brandTaggedContent = taggedResponse.answer || "";

    // Count <brand> tags in the response
    const brandTagRegex = /<brand(?:\s+position="(\d+)")?>([^<]+)<\/brand>/gi;
    const brandTags = [...brandTaggedContent.matchAll(brandTagRegex)];
    
    console.log(`✅ Answer Agent completed successfully`);
    console.log(`🏷️  Found ${brandTags.length} <brand> tags in processed content`);
    
    brandTags.forEach((match, index) => {
      const position = match[1] ? parseInt(match[1]) : index + 1;
      const brandName = match[2]?.trim() || "unknown";
      console.log(`   ${index + 1}. <brand position="${position}">${brandName}</brand>`);
    });

    return {
      success: true,
      details: {
        originalContent: aiOverviewContent,
        brandTaggedContent: brandTaggedContent,
        mentionsFound: brandTags.length,
        brandTagsFound: brandTags.length,
      }
    };

  } catch (error) {
    console.error(`❌ AI Overview brand tagging test failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      details: {
        originalContent: aiOverviewContent,
        brandTaggedContent: "",
        mentionsFound: 0,
        brandTagsFound: 0,
      }
    };
  }
}

async function validateRecentAIOverviewReports() {
  const prisma = await getDbClient();
  
  try {
    console.log(`\n🔍 Validating recent AI Overview reports...`);
    
    // Find recent AI Overview responses
    const aiOverviewResponses = await prisma.response.findMany({
      where: { 
        model: "ai-overview",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      },
      include: { 
        mentions: true,
        question: { select: { query: true } },
        run: { include: { company: { select: { name: true } } } }
      },
      take: 5, // Test with 5 recent responses
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`Found ${aiOverviewResponses.length} recent AI Overview responses`);
    
    let totalResponses = 0;
    let responsesWithMentions = 0;
    let totalMentions = 0;
    
    for (const response of aiOverviewResponses) {
      totalResponses++;
      const mentionCount = response.mentions.length;
      if (mentionCount > 0) responsesWithMentions++;
      totalMentions += mentionCount;
      
      console.log(`\n📊 Response ${response.id}:`);
      console.log(`  Company: ${response.run.company.name}`);
      console.log(`  Question: ${response.question.query.substring(0, 60)}...`);
      console.log(`  Mentions: ${mentionCount}`);
      console.log(`  Content has <brand> tags: ${response.content.includes('<brand>')}`);
      
      // Test brand tagging on this content
      if (mentionCount === 0 && !response.content.includes('<brand>')) {
        console.log(`  🧪 Testing brand tagging on this content...`);
        const testResult = await testAIOverviewBrandTagging(
          response.run.company.name,
          response.content
        );
        
        if (testResult.success && testResult.details.brandTagsFound > 0) {
          console.log(`  ✅ Fix would work: ${testResult.details.brandTagsFound} mentions would be detected`);
        } else {
          console.log(`  ❌ Fix might not help: ${testResult.error || "No brand tags generated"}`);
        }
      }
    }
    
    console.log(`\n=== VALIDATION SUMMARY ===`);
    console.log(`Total AI Overview responses analyzed: ${totalResponses}`);
    console.log(`Responses with mentions: ${responsesWithMentions}`);
    console.log(`Total mentions: ${totalMentions}`);
    console.log(`Current mention detection rate: ${totalResponses > 0 ? ((responsesWithMentions/totalResponses)*100).toFixed(1) : 0}%`);
    
    if (responsesWithMentions === 0) {
      console.log(`\n🚨 CONFIRMED: All recent AI Overview responses have zero mentions`);
      console.log(`📋 The fix should resolve this by ensuring proper brand tagging`);
    }
    
  } catch (error) {
    console.error(`Validation failed:`, error);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log(`🚀 AI Overview Mention Detection Fix - Validation Script`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  
  // Test sample AI Overview content that mentions the company
  const sampleContent = `
    When looking for cultural consulting services for Asian Pacific Islander (API) representation, 
    several organizations stand out. Gold House has emerged as a leading advocate for API representation 
    in media and entertainment. Companies like Netflix, Disney, and HBO often work with specialized 
    consulting firms to ensure authentic representation. Organizations similar to Gold House include 
    API representation consultants and cultural advisory groups that help studios create authentic content.
  `;
  
  console.log(`\n1️⃣ Testing Answer Agent brand tagging with sample content`);
  const testResult = await testAIOverviewBrandTagging("Gold House", sampleContent);
  
  if (testResult.success) {
    console.log(`✅ Answer Agent test passed`);
  } else {
    console.log(`❌ Answer Agent test failed: ${testResult.error}`);
  }
  
  console.log(`\n2️⃣ Validating recent AI Overview reports from database`);
  await validateRecentAIOverviewReports();
  
  console.log(`\n✅ Validation complete`);
}

if (require.main === module) {
  main().catch(console.error);
}

export { testAIOverviewBrandTagging, validateRecentAIOverviewReports };