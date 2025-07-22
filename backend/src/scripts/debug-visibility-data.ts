#!/usr/bin/env ts-node

import { getDbClient } from '../config/database';

async function main() {
  const db = await getDbClient();
  const companyId = 'cmda1h9iu00016gwbm8rd659g';
  
  console.log('=== DEBUGGING VISIBILITY DATA PIPELINE ===\n');
  
  // DEBUG: Check current server time and timezone
  const now = new Date();
  console.log(`SERVER TIME: ${now.toISOString()} (UTC)`);
  console.log(`SERVER LOCAL: ${now.toString()}`);
  console.log(`TIMEZONE OFFSET: ${now.getTimezoneOffset()} minutes\n`);
  
  // 1. Check recent report runs
  console.log('1. RECENT REPORT RUNS:');
  const reports = await db.reportRun.findMany({
    where: { companyId },
    select: { id: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  reports.forEach(r => {
    console.log(`  ${r.id} | ${r.status} | ${r.createdAt.toISOString()}`);
  });
  
  // 2. Check if reportMetrics exist for recent runs
  console.log('\n2. REPORT METRICS:');
  const metrics = await db.reportMetric.findMany({
    where: { companyId },
    select: { 
      id: true, 
      reportId: true, 
      shareOfVoice: true, 
      shareOfVoiceChange: true,
      createdAt: true 
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  metrics.forEach(m => {
    console.log(`  ${m.reportId} | SoV: ${m.shareOfVoice} | Change: ${m.shareOfVoiceChange} | ${m.createdAt.toISOString()}`);
  });
  
  // 3. Check ShareOfVoiceHistory table
  console.log('\n3. SHARE OF VOICE HISTORY:');
  const sovHistory = await db.shareOfVoiceHistory.findMany({
    where: { companyId },
    select: { 
      date: true, 
      aiModel: true, 
      shareOfVoice: true, 
      reportRunId: true,
      createdAt: true 
    },
    orderBy: { date: 'desc' },
    take: 10
  });
  if (sovHistory.length === 0) {
    console.log('  ⚠️  NO DATA FOUND in ShareOfVoiceHistory table');
  } else {
    sovHistory.forEach(h => {
      console.log(`  ${h.date.toISOString().split('T')[0]} | ${h.aiModel} | SoV: ${h.shareOfVoice} | RunID: ${h.reportRunId?.substring(0, 8)}...`);
    });
  }
  
  // 4. Check SentimentOverTime table
  console.log('\n4. SENTIMENT OVER TIME:');
  const sentimentHistory = await db.sentimentOverTime.findMany({
    where: { companyId },
    select: { 
      date: true, 
      aiModel: true, 
      sentimentScore: true, 
      reportRunId: true,
      createdAt: true 
    },
    orderBy: { date: 'desc' },
    take: 10
  });
  if (sentimentHistory.length === 0) {
    console.log('  ⚠️  NO DATA FOUND in SentimentOverTime table');
  } else {
    sentimentHistory.forEach(s => {
      console.log(`  ${s.date.toISOString().split('T')[0]} | ${s.aiModel} | Sentiment: ${s.sentimentScore} | RunID: ${s.reportRunId?.substring(0, 8)}...`);
    });
  }
  
  // 5. Check for today's date specifically
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  console.log(`\n5. TODAY'S DATA (${today.toISOString().split('T')[0]}):`);
  const todaySov = await db.shareOfVoiceHistory.count({
    where: { 
      companyId,
      date: today
    }
  });
  const todaySentiment = await db.sentimentOverTime.count({
    where: { 
      companyId,
      date: today
    }
  });
  console.log(`  ShareOfVoice records: ${todaySov}`);
  console.log(`  Sentiment records: ${todaySentiment}`);
  
  process.exit(0);
}

main().catch(console.error);