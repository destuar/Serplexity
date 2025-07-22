#!/usr/bin/env node

// Test citation database saving with report worker logic
process.env.NODE_ENV = 'development';
process.env.SECRETS_PROVIDER = 'aws';
process.env.DATABASE_SECRET_NAME = 'serplexity-db';
process.env.AWS_ACCESS_KEY_ID = 'AKIAVFIWIQECD5NKMCUX';
process.env.AWS_SECRET_ACCESS_KEY = '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';
process.env.AWS_REGION = 'us-east-2';

const { PrismaClient } = require('@prisma/client');
const { pydanticLlmService } = require('./dist/services/pydanticLlmService');

const prisma = new PrismaClient();

async function testCitationDatabaseSaving() {
  console.log('🗄️  CITATION DATABASE SAVING TEST');
  console.log('=' .repeat(80));
  console.log('Testing citation extraction and database saving...\n');

  try {
    // First, get an answer with citations from the answer agent
    console.log('📝 Step 1: Getting answer with web search citations...');
    
    const question = "What are the key benefits of cloud computing for small businesses in 2024?";
    const company = "Microsoft";
    
    const result = await pydanticLlmService.executeAgent(
      "answer_agent.py",
      {
        question: question,
        company_name: company,
        competitors: ["Amazon", "Google"],
        use_web_search: true,
        max_tokens: 1200
      },
      null,
      { modelId: "openai:gpt-4o-mini", timeout: 120000 }
    );

    if (!result.data?.answer) {
      throw new Error('No answer returned from answer agent');
    }

    const answer = result.data.answer;
    console.log(`✅ Got answer: ${answer.length} characters`);
    console.log(`📝 Answer preview: "${answer.substring(0, 150)}..."`);

    // Step 2: Extract citations using the same logic as reportWorker
    console.log('\n📝 Step 2: Extracting citations using reportWorker logic...');
    
    const citations = new Set();
    let citationPosition = 1;

    // 1. Extract markdown-style citations [title](url)
    const markdownRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let markdownMatch;
    while ((markdownMatch = markdownRegex.exec(answer)) !== null) {
      const title = markdownMatch[1];
      const url = markdownMatch[2];
      citations.add(JSON.stringify({ url, title, source: 'markdown' }));
    }

    // 2. Extract natural URLs
    const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&=]*)/g;
    const urlMatches = answer.match(urlRegex) || [];
    
    for (const url of urlMatches) {
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace('www.', '');
        const title = `${domain.charAt(0).toUpperCase() + domain.slice(1)} - Web Result`;
        citations.add(JSON.stringify({ url, title, source: 'natural' }));
      } catch (error) {
        console.log(`   ⚠️  Invalid URL skipped: ${url}`);
        continue;
      }
    }

    const citationArray = Array.from(citations).map(c => JSON.parse(c));
    console.log(`✅ Extracted ${citationArray.length} unique citations`);
    
    if (citationArray.length > 0) {
      console.log('📋 Citations extracted:');
      citationArray.slice(0, 5).forEach((citation, idx) => {
        console.log(`   ${idx + 1}. [${citation.source}] ${citation.title}`);
        console.log(`      URL: ${citation.url}`);
      });
    }

    // Step 3: Create a test report to save citations to
    console.log('\n📝 Step 3: Creating test report in database...');
    
    const testReport = await prisma.report.create({
      data: {
        question: question,
        answer: answer,
        company: company,
        competitors: ["Amazon", "Google"],
        status: 'completed',
        confidence: result.data.confidence || 0.85,
        total_mentions: result.data.brand_mentions_count || 0,
        processing_time: result.metadata.executionTime,
        job_id: `test-citation-${Date.now()}`
      }
    });

    console.log(`✅ Created test report: ID ${testReport.id}`);

    // Step 4: Save citations to database
    console.log('\n📝 Step 4: Saving citations to database...');
    
    let savedCount = 0;
    for (const citation of citationArray) {
      try {
        const savedCitation = await prisma.citation.create({
          data: {
            report_id: testReport.id,
            url: citation.url,
            title: citation.title,
            position: citationPosition++,
            domain: new URL(citation.url).hostname.replace('www.', ''),
            source_type: citation.source
          }
        });
        savedCount++;
        console.log(`   ✅ Saved citation ${savedCount}: ${citation.title}`);
      } catch (error) {
        console.log(`   ❌ Failed to save citation: ${error.message}`);
      }
    }

    console.log(`✅ Saved ${savedCount}/${citationArray.length} citations to database`);

    // Step 5: Verify citations were saved
    console.log('\n📝 Step 5: Verifying citations in database...');
    
    const savedCitations = await prisma.citation.findMany({
      where: { report_id: testReport.id },
      orderBy: { position: 'asc' }
    });

    console.log(`✅ Found ${savedCitations.length} citations in database for report ${testReport.id}`);
    
    if (savedCitations.length > 0) {
      console.log('📋 Saved citations:');
      savedCitations.forEach((citation, idx) => {
        console.log(`   ${idx + 1}. [${citation.source_type}] ${citation.title}`);
        console.log(`      URL: ${citation.url}`);
        console.log(`      Domain: ${citation.domain}`);
        console.log(`      Position: ${citation.position}`);
      });
    }

    // Step 6: Test citation retrieval
    console.log('\n📝 Step 6: Testing citation retrieval...');
    
    const reportWithCitations = await prisma.report.findUnique({
      where: { id: testReport.id },
      include: {
        citations: {
          orderBy: { position: 'asc' }
        }
      }
    });

    console.log(`✅ Retrieved report with ${reportWithCitations.citations.length} citations`);

    // Analysis
    console.log('\n📊 CITATION PIPELINE ANALYSIS:');
    console.log('=' .repeat(50));
    console.log(`✅ Answer Agent: Working with web search`);
    console.log(`✅ Citation Extraction: ${citationArray.length} citations extracted`);
    console.log(`✅ Database Saving: ${savedCount} citations saved`);
    console.log(`✅ Citation Retrieval: ${reportWithCitations.citations.length} citations retrieved`);
    
    const success = citationArray.length > 0 && 
                   savedCount > 0 && 
                   savedCount === reportWithCitations.citations.length;
    
    if (success) {
      console.log('🎯 COMPLETE SUCCESS: Full citation pipeline working!');
    } else {
      console.log('⚠️  PARTIAL SUCCESS: Some issues detected');
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await prisma.citation.deleteMany({ where: { report_id: testReport.id } });
    await prisma.report.delete({ where: { id: testReport.id } });
    console.log('✅ Test data cleaned up');

    console.log('\n🏁 CITATION DATABASE TEST COMPLETED');
    
    return {
      citationsExtracted: citationArray.length,
      citationsSaved: savedCount,
      success: success
    };

  } catch (error) {
    console.error('❌ Citation database test failed:', error.message);
    if (error.stack) {
      console.error('📍 Stack trace:', error.stack.split('\n').slice(0, 10).join('\n'));
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testCitationDatabaseSaving().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});