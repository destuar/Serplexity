#!/usr/bin/env ts-node

/**
 * Script to fix reports with null stepStatus
 * 
 * This script identifies reports that have null stepStatus and fixes them by:
 * 1. Setting appropriate stepStatus based on their current state
 * 2. Handling different scenarios (PENDING, RUNNING, COMPLETED, FAILED)
 * 3. Providing options for dry-run and actual fixes
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ReportAnalysis {
  id: string;
  companyName: string;
  status: string;
  stepStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
  hasResponses: boolean;
  hasMetrics: boolean;
  hasOptimizationTasks: boolean;
  suggestedStepStatus: string;
  suggestedAction: 'SET_STEP_STATUS' | 'MARK_FAILED' | 'MARK_COMPLETED' | 'LEAVE_AS_IS';
  reasoning: string;
}

async function analyzeReportsWithNullSteps(): Promise<ReportAnalysis[]> {
  console.log('🔍 Analyzing reports with null stepStatus...\n');
  
  const reportsWithNullSteps = await prisma.reportRun.findMany({
    where: {
      stepStatus: null
    },
    include: {
      company: {
        select: { name: true }
      },
      fanoutResponses: {
        select: { id: true }
      },
      reportMetrics: {
        select: { id: true }
      },
      optimizationTasks: {
        select: { id: true }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  const analyses: ReportAnalysis[] = [];

  for (const report of reportsWithNullSteps) {
    const hasResponses = report.fanoutResponses.length > 0;
    const hasMetrics = report.reportMetrics.length > 0;
    const hasOptimizationTasks = report.optimizationTasks.length > 0;
    
    // Calculate how old the report is
    const ageInMinutes = (Date.now() - report.createdAt.getTime()) / (1000 * 60);
    const ageInHours = ageInMinutes / 60;
    const ageInDays = ageInHours / 24;

    let suggestedStepStatus: string;
    let suggestedAction: ReportAnalysis['suggestedAction'];
    let reasoning: string;

    // Analyze based on current status and data
    if (report.status === 'COMPLETED') {
      if (hasMetrics && hasResponses) {
        suggestedStepStatus = 'COMPLETED';
        suggestedAction = 'SET_STEP_STATUS';
        reasoning = 'Report is marked as COMPLETED and has all expected data';
      } else {
        suggestedStepStatus = 'COMPLETED';
        suggestedAction = 'SET_STEP_STATUS';
        reasoning = 'Report is marked as COMPLETED but may be missing some data';
      }
    } else if (report.status === 'FAILED') {
      suggestedStepStatus = 'FAILED';
      suggestedAction = 'SET_STEP_STATUS';
      reasoning = 'Report is marked as FAILED, stepStatus should reflect this';
    } else if (report.status === 'RUNNING') {
      if (ageInMinutes > 30) {
        // Report has been running for more than 30 minutes, likely stuck
        suggestedStepStatus = 'FAILED: Stuck in processing';
        suggestedAction = 'MARK_FAILED';
        reasoning = `Report has been in RUNNING state for ${Math.round(ageInMinutes)} minutes, likely stuck`;
      } else {
        suggestedStepStatus = 'Processing...';
        suggestedAction = 'SET_STEP_STATUS';
        reasoning = 'Report is currently running, set a generic processing status';
      }
    } else if (report.status === 'PENDING') {
      if (ageInDays > 1) {
        // Report has been pending for more than 1 day, likely abandoned
        suggestedStepStatus = 'FAILED: Job never started';
        suggestedAction = 'MARK_FAILED';
        reasoning = `Report has been PENDING for ${Math.round(ageInDays)} days, likely abandoned`;
      } else if (ageInHours > 1) {
        // Report has been pending for more than 1 hour, possibly stuck
        suggestedStepStatus = 'FAILED: Job queue timeout';
        suggestedAction = 'MARK_FAILED';
        reasoning = `Report has been PENDING for ${Math.round(ageInHours)} hours, possibly stuck in queue`;
      } else {
        suggestedStepStatus = 'Queued for processing';
        suggestedAction = 'SET_STEP_STATUS';
        reasoning = 'Report is recently queued, set appropriate pending status';
      }
    } else {
      // Unknown status
      suggestedStepStatus = 'Unknown state';
      suggestedAction = 'LEAVE_AS_IS';
      reasoning = `Unknown status: ${report.status}`;
    }

    analyses.push({
      id: report.id,
      companyName: report.company.name,
      status: report.status,
      stepStatus: report.stepStatus,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      hasResponses,
      hasMetrics,
      hasOptimizationTasks,
      suggestedStepStatus,
      suggestedAction,
      reasoning
    });
  }

  return analyses;
}

async function displayAnalysis(analyses: ReportAnalysis[]): Promise<void> {
  console.log(`📊 Found ${analyses.length} reports with null stepStatus:\n`);
  
  if (analyses.length === 0) {
    console.log('✅ No reports with null stepStatus found!');
    return;
  }

  analyses.forEach((analysis, index) => {
    console.log(`${index + 1}. ${analysis.companyName} (${analysis.id})`);
    console.log(`   Status: ${analysis.status}`);
    console.log(`   Created: ${analysis.createdAt.toISOString()}`);
    console.log(`   Age: ${Math.round((Date.now() - analysis.createdAt.getTime()) / (1000 * 60))} minutes`);
    console.log(`   Has Responses: ${analysis.hasResponses}`);
    console.log(`   Has Metrics: ${analysis.hasMetrics}`);
    console.log(`   Has Optimization Tasks: ${analysis.hasOptimizationTasks}`);
    console.log(`   Suggested Action: ${analysis.suggestedAction}`);
    console.log(`   Suggested Step Status: "${analysis.suggestedStepStatus}"`);
    console.log(`   Reasoning: ${analysis.reasoning}`);
    console.log('');
  });

  // Summary by action
  const actionCounts = analyses.reduce((acc, analysis) => {
    acc[analysis.suggestedAction] = (acc[analysis.suggestedAction] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('📋 Summary of suggested actions:');
  Object.entries(actionCounts).forEach(([action, count]) => {
    console.log(`   ${action}: ${count} reports`);
  });
}

async function applyFixes(analyses: ReportAnalysis[], dryRun: boolean = true): Promise<void> {
  if (dryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made to the database\n');
    return;
  }

  console.log('\n⚠️  REPAIR MODE - Making changes to the database...\n');
  
  let fixedCount = 0;
  let failedCount = 0;

  for (const analysis of analyses) {
    if (analysis.suggestedAction === 'LEAVE_AS_IS') {
      console.log(`⏭️  Skipping: ${analysis.companyName} (${analysis.id})`);
      continue;
    }

    try {
      if (analysis.suggestedAction === 'SET_STEP_STATUS') {
        await prisma.reportRun.update({
          where: { id: analysis.id },
          data: {
            stepStatus: analysis.suggestedStepStatus,
            updatedAt: new Date()
          }
        });
        console.log(`✅ Set step status: ${analysis.companyName} (${analysis.id}) -> "${analysis.suggestedStepStatus}"`);
      } else if (analysis.suggestedAction === 'MARK_FAILED') {
        await prisma.reportRun.update({
          where: { id: analysis.id },
          data: {
            status: 'FAILED',
            stepStatus: analysis.suggestedStepStatus,
            updatedAt: new Date()
          }
        });
        console.log(`❌ Marked as failed: ${analysis.companyName} (${analysis.id}) -> "${analysis.suggestedStepStatus}"`);
      } else if (analysis.suggestedAction === 'MARK_COMPLETED') {
        await prisma.reportRun.update({
          where: { id: analysis.id },
          data: {
            status: 'COMPLETED',
            stepStatus: analysis.suggestedStepStatus,
            updatedAt: new Date()
          }
        });
        console.log(`✅ Marked as completed: ${analysis.companyName} (${analysis.id}) -> "${analysis.suggestedStepStatus}"`);
      }
      
      fixedCount++;
    } catch (error) {
      console.error(`❌ Failed to fix ${analysis.id}:`, error);
      failedCount++;
    }
  }

  console.log(`\n🎉 Successfully fixed ${fixedCount}/${analyses.length} reports`);
  if (failedCount > 0) {
    console.log(`❌ Failed to fix ${failedCount} reports`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--fix');
  
  console.log('🔧 Fix Null Step Reports Script\n');
  
  if (dryRun) {
    console.log('Running in DRY RUN mode. Use --fix to apply changes.\n');
  }

  try {
    const analyses = await analyzeReportsWithNullSteps();
    await displayAnalysis(analyses);
    await applyFixes(analyses, dryRun);
    
    if (dryRun && analyses.length > 0) {
      console.log('\n💡 To apply these fixes, run:');
      console.log('   npm run script fix-null-step-reports -- --fix');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main().catch(console.error); 