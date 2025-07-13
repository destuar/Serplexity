#!/usr/bin/env ts-node

import { queueReport } from '../services/reportSchedulingService';
import prisma from '../config/db';

async function manualReportTrigger() {
    console.log('🔄 Manually triggering report generation...\n');
    
    try {
        // Get the first eligible company
        const company = await prisma.company.findFirst({
            where: {
                runs: {
                    some: {
                        status: 'COMPLETED',
                    },
                },
            },
            select: {
                id: true,
                name: true
            }
        });

        if (!company) {
            console.log('❌ No eligible companies found');
            return;
        }

        console.log(`📊 Triggering report for: ${company.name} (${company.id})`);
        
        // Force a new report (bypass daily cache)
        const result = await queueReport(company.id, true);
        
        console.log(`✅ Report queued successfully:`);
        console.log(`   Run ID: ${result.runId}`);
        console.log(`   Is New: ${result.isNew}`);
        console.log(`   Status: ${result.status}`);
        
        // Check the queue status
        console.log('\n📋 Checking queue status...');
        
        // Wait a moment and check if the report was created
        setTimeout(async () => {
            try {
                const reportRun = await prisma.reportRun.findUnique({
                    where: { id: result.runId },
                    include: {
                        company: {
                            select: { name: true }
                        }
                    }
                });
                
                if (reportRun) {
                    console.log(`📊 Report status: ${reportRun.status}`);
                    console.log(`   Company: ${reportRun.company.name}`);
                    console.log(`   Created: ${reportRun.createdAt.toISOString()}`);
                    console.log(`   Updated: ${reportRun.updatedAt.toISOString()}`);
                    if (reportRun.stepStatus) {
                        console.log(`   Step: ${reportRun.stepStatus}`);
                    }
                } else {
                    console.log('❌ Report run not found');
                }
            } catch (error) {
                console.error('❌ Error checking report status:', error);
            } finally {
                await prisma.$disconnect();
                process.exit(0);
            }
        }, 2000);
        
    } catch (error) {
        console.error('❌ Error triggering report:', error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

manualReportTrigger().catch(console.error); 