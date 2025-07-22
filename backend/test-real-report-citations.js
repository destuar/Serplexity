#!/usr/bin/env node

// Test real report generation to see if citations are being saved
process.env.NODE_ENV = 'development';
process.env.SECRETS_PROVIDER = 'aws';
process.env.DATABASE_SECRET_NAME = 'serplexity-db';
process.env.AWS_ACCESS_KEY_ID = 'AKIAVFIWIQECD5NKMCUX';
process.env.AWS_SECRET_ACCESS_KEY = '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';
process.env.AWS_REGION = 'us-east-2';

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testRealReportCitations() {
  console.log('📊 REAL REPORT CITATION TEST');
  console.log('=' .repeat(60));
  console.log('Checking recent reports for citation data...\n');

  try {
    // Get the most recent reports
    console.log('📝 Fetching recent reports with citations...');
    
    const recentReports = await prisma.report.findMany({
      include: {
        citations: {
          orderBy: { position: 'asc' }
        },
        responses: {
          include: {
            citations: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
      take: 10
    });

    console.log(`✅ Found ${recentReports.length} recent reports`);

    if (recentReports.length === 0) {
      console.log('⚠️  No reports found. Try running a report generation first.');
      return;
    }

    console.log('\n📋 Report Citation Analysis:');
    console.log('-'.repeat(50));

    let totalReportsWithCitations = 0;
    let totalCitations = 0;

    for (let i = 0; i < Math.min(recentReports.length, 5); i++) {
      const report = recentReports[i];
      const reportCitations = report.citations || [];
      const responseCitations = report.responses?.reduce((acc, resp) => acc + (resp.citations?.length || 0), 0) || 0;
      
      console.log(`\n📄 Report ${i + 1} (ID: ${report.id}):`);
      console.log(`   Question: "${report.question?.substring(0, 80) || 'N/A'}..."`);
      console.log(`   Company: ${report.company || 'N/A'}`);
      console.log(`   Created: ${report.created_at?.toISOString() || 'N/A'}`);
      console.log(`   Status: ${report.status || 'N/A'}`);
      console.log(`   Citations (report level): ${reportCitations.length}`);
      console.log(`   Citations (response level): ${responseCitations}`);
      
      const totalCitesThisReport = reportCitations.length + responseCitations;
      if (totalCitesThisReport > 0) {
        totalReportsWithCitations++;
        totalCitations += totalCitesThisReport;
        
        // Show some example citations
        const allCitations = [
          ...reportCitations.map(c => ({ ...c, level: 'report' })),
          ...report.responses?.flatMap(resp => resp.citations?.map(c => ({ ...c, level: 'response' })) || []) || []
        ];
        
        console.log(`   📎 Example citations:`);
        allCitations.slice(0, 3).forEach((citation, idx) => {
          console.log(`      ${idx + 1}. [${citation.level}] ${citation.title || 'No title'}`);
          console.log(`         URL: ${citation.url?.substring(0, 60) || 'No URL'}...`);
          console.log(`         Domain: ${citation.domain || 'No domain'}`);
        });
        
        if (allCitations.length > 3) {
          console.log(`      ... and ${allCitations.length - 3} more citations`);
        }
      } else {
        console.log(`   ⚠️  No citations found`);
      }
    }

    // Summary
    console.log('\n📊 CITATION SUMMARY:');
    console.log('=' .repeat(50));
    console.log(`📈 Reports analyzed: ${Math.min(recentReports.length, 5)}`);
    console.log(`📈 Reports with citations: ${totalReportsWithCitations}`);
    console.log(`📈 Total citations found: ${totalCitations}`);
    console.log(`📈 Average citations per report: ${totalReportsWithCitations > 0 ? (totalCitations / totalReportsWithCitations).toFixed(1) : '0'}`);

    // Assessment
    const citationRate = totalReportsWithCitations / Math.min(recentReports.length, 5);
    console.log(`📈 Citation rate: ${(citationRate * 100).toFixed(1)}%`);

    console.log('\n🎯 ASSESSMENT:');
    if (citationRate >= 0.8 && totalCitations > 0) {
      console.log('✅ EXCELLENT: Citations are being consistently saved');
    } else if (citationRate >= 0.5 && totalCitations > 0) {
      console.log('✅ GOOD: Citations are being saved for most reports');
    } else if (totalCitations > 0) {
      console.log('⚠️  PARTIAL: Some citations are being saved but not consistently');
    } else {
      console.log('❌ ISSUE: No citations found in recent reports');
      console.log('   → Check if web search is working');
      console.log('   → Verify citation extraction logic');
      console.log('   → Confirm database saving process');
    }

    // Check for web search indicators in answers
    console.log('\n🔍 WEB SEARCH ANALYSIS:');
    const reportsWithAnswers = recentReports.filter(r => r.answer);
    let reportsWithWebIndicators = 0;
    
    const webIndicators = ['according to', 'recent', 'latest', 'current', '2024', '2025', 'FDA', 'announced'];
    
    for (const report of reportsWithAnswers) {
      if (report.answer) {
        const hasWebIndicator = webIndicators.some(indicator => 
          report.answer.toLowerCase().includes(indicator.toLowerCase())
        );
        if (hasWebIndicator) {
          reportsWithWebIndicators++;
        }
      }
    }
    
    console.log(`📊 Reports with web search indicators: ${reportsWithWebIndicators}/${reportsWithAnswers.length}`);
    
    if (reportsWithWebIndicators > 0 && totalCitations === 0) {
      console.log('⚠️  Reports show web search usage but no citations saved');
      console.log('   → Citation extraction may have issues');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n🏁 REAL REPORT CITATION TEST COMPLETED');
}

// Run the test
testRealReportCitations().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});