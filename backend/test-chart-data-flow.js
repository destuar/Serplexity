#!/usr/bin/env ts-node
/**
 * Test script to verify chart data flow and point display
 * Tests the exact data pipeline that frontend charts use
 */
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

async function testChartDataFlow() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🧪 TESTING CHART DATA FLOW FOR GOLD HOUSE\n');
    
    // 1. Get Gold House company ID
    const goldHouse = await prisma.company.findFirst({
      where: { name: { contains: 'Gold House', mode: 'insensitive' } },
      select: { id: true, name: true }
    });
    
    if (!goldHouse) {
      console.log('❌ Gold House not found');
      return;
    }
    
    console.log(`✅ Testing company: ${goldHouse.name} (${goldHouse.id})\n`);
    
    // 2. Test database data directly
    console.log('📊 DATABASE DATA VERIFICATION:');
    
    const rawData = await prisma.shareOfVoiceHistory.findMany({
      where: { companyId: goldHouse.id },
      orderBy: { createdAt: 'desc' },
      select: {
        date: true,
        aiModel: true,
        shareOfVoice: true,
        reportRunId: true,
        createdAt: true
      }
    });
    
    console.log(`Total database entries: ${rawData.length}`);
    
    // Group by AI model to understand distribution
    const modelCounts = rawData.reduce((acc, item) => {
      acc[item.aiModel] = (acc[item.aiModel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('Data points per AI model:');
    Object.entries(modelCounts).forEach(([model, count]) => {
      console.log(`  - ${model}: ${count} points`);
    });
    
    // Group by report run to understand report distribution
    const reportCounts = rawData.reduce((acc, item) => {
      acc[item.reportRunId] = (acc[item.reportRunId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`\nData points per report: ${Object.keys(reportCounts).length} reports`);
    Object.entries(reportCounts).forEach(([reportId, count]) => {
      console.log(`  - ${reportId}: ${count} points`);
    });
    
    // 3. Test API endpoints that frontend uses
    console.log('\n🌐 API ENDPOINT TESTING:');
    
    const baseUrl = 'http://localhost:8001/api';
    
    // Test DashboardContext endpoint (raw data)
    console.log('\n1. Testing DashboardContext endpoint (RAW data):');
    try {
      const dashboardResponse = await fetch(`${baseUrl}/companies/${goldHouse.id}/share-of-voice-history?dateRange=30d&aiModel=all`);
      
      if (!dashboardResponse.ok) {
        console.log(`❌ Dashboard API failed: ${dashboardResponse.status}`);
      } else {
        const dashboardData = await dashboardResponse.json();
        console.log(`✅ Dashboard API success: ${dashboardData.length} data points`);
        console.log('Sample data points:');
        dashboardData.slice(0, 3).forEach((item, i) => {
          console.log(`  ${i + 1}. ${item.date} | ${item.aiModel} | ${item.shareOfVoice}%`);
        });
      }
    } catch (error) {
      console.log(`❌ Dashboard API error: ${error.message}`);
    }
    
    // Test MetricsOverTimeCard endpoint (daily granularity)
    console.log('\n2. Testing MetricsOverTimeCard endpoint (DAILY granularity):');
    try {
      const metricsResponse = await fetch(`${baseUrl}/companies/${goldHouse.id}/share-of-voice-history?dateRange=30d&aiModel=all&granularity=day`);
      
      if (!metricsResponse.ok) {
        console.log(`❌ Metrics API failed: ${metricsResponse.status}`);
      } else {
        const metricsData = await metricsResponse.json();
        console.log(`✅ Metrics API success: ${metricsData.length} data points`);
        console.log('Sample data points:');
        metricsData.slice(0, 3).forEach((item, i) => {
          console.log(`  ${i + 1}. ${item.date} | ${item.aiModel} | ${item.shareOfVoice}% | Reports: ${item.reportCount || 1}`);
        });
      }
    } catch (error) {
      console.log(`❌ Metrics API error: ${error.message}`);
    }
    
    // Test with specific model filter
    console.log('\n3. Testing with specific model filter (gpt-4.1-mini):');
    try {
      const modelResponse = await fetch(`${baseUrl}/companies/${goldHouse.id}/share-of-voice-history?dateRange=30d&aiModel=gpt-4.1-mini&granularity=day`);
      
      if (!modelResponse.ok) {
        console.log(`❌ Model filter API failed: ${modelResponse.status}`);
      } else {
        const modelData = await modelResponse.json();
        console.log(`✅ Model filter API success: ${modelData.length} data points`);
        console.log('gpt-4.1-mini data points:');
        modelData.forEach((item, i) => {
          console.log(`  ${i + 1}. ${item.date} | ${item.shareOfVoice}%`);
        });
      }
    } catch (error) {
      console.log(`❌ Model filter API error: ${error.message}`);
    }
    
    // 4. Test backend query logic directly
    console.log('\n🔧 BACKEND QUERY LOGIC TESTING:');
    
    // Test the new smart daily granularity logic
    const dateSpanCheck = await prisma.$queryRawUnsafe(`
      SELECT 
        DATE(MIN(date)) as min_date,
        DATE(MAX(date)) as max_date,
        COUNT(DISTINCT DATE(date)) as unique_days
      FROM "ShareOfVoiceHistory" 
      WHERE "companyId" = '${goldHouse.id}'
        AND date >= NOW() - INTERVAL '30 days'
    `);
    
    const spanInfo = (dateSpanCheck as Array<{ min_date: Date; max_date: Date; unique_days: string }>)[0];
    const uniqueDays = parseInt(spanInfo.unique_days);
    
    console.log(`Date span analysis:`);
    console.log(`  - Min date: ${spanInfo.min_date}`);
    console.log(`  - Max date: ${spanInfo.max_date}`);
    console.log(`  - Unique days: ${uniqueDays}`);
    console.log(`  - Smart daily logic: ${uniqueDays <= 2 ? 'Will show individual reports' : 'Will aggregate by day'}`);
    
    // 5. Expected vs Actual Results
    console.log('\n📈 EXPECTED CHART BEHAVIOR:');
    console.log(`For Gold House with ${Object.keys(reportCounts).length} reports:`);
    console.log(`  - "All" model filter: Should show ${reportCounts[Object.keys(reportCounts)[0]] ? Object.keys(reportCounts).length : 0} points (one per report)`);
    console.log(`  - Specific model filter: Should show ${Object.keys(reportCounts).length} points (one per report per model)`);
    console.log(`  - No model filter: Should show ${rawData.length} points (all individual data points)`);
    console.log(`  - Daily granularity with ${uniqueDays} days: Should show individual reports (not aggregated)`);
    
    // 6. Recommendations
    console.log('\n💡 TESTING RECOMMENDATIONS:');
    console.log('1. Open browser DevTools console');
    console.log('2. Navigate to Gold House dashboard');
    console.log('3. Look for these console logs:');
    console.log('   - "[DashboardContext] ShareOfVoiceHistory count: X"');
    console.log('   - "[MetricsOverTimeCard] Received SOV history: X points"');
    console.log('   - "[ShareOfVoiceHistory] Daily granularity check: X unique days"');
    console.log('4. Verify chart displays the expected number of points');
    console.log('5. Test different granularity settings and model filters');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
console.log('Starting chart data flow test...\n');
testChartDataFlow();