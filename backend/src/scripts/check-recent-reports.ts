#!/usr/bin/env ts-node

import { getDbClient } from '../config/database';

async function checkRecentReports() {
  const prisma = await getDbClient();
    console.log('📊 Checking recent report runs...\n');
    
    try {
        const recentRuns = await prisma.reportRun.findMany({
            where: {
                createdAt: {
                    gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
                }
            },
            include: {
                company: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 10
        });

        if (recentRuns.length === 0) {
            console.log('❌ No report runs found in the last hour');
        } else {
            console.log(`✅ Found ${recentRuns.length} recent report runs:`);
            recentRuns.forEach((run, index) => {
                console.log(`  ${index + 1}. ${run.company.name} - ${run.status}`);
                console.log(`     ID: ${run.id}`);
                console.log(`     Created: ${run.createdAt.toISOString()}`);
                console.log(`     Updated: ${run.updatedAt.toISOString()}`);
                if (run.stepStatus) {
                    console.log(`     Step: ${run.stepStatus}`);
                }
                console.log('');
            });
        }

        // Also check for any pending/running reports
        const activeRuns = await prisma.reportRun.findMany({
            where: {
                status: {
                    in: ['PENDING', 'RUNNING']
                }
            },
            include: {
                company: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        if (activeRuns.length > 0) {
            console.log(`🔄 Currently active report runs (${activeRuns.length}):`);
            activeRuns.forEach((run, index) => {
                console.log(`  ${index + 1}. ${run.company.name} - ${run.status}`);
                console.log(`     Step: ${run.stepStatus || 'N/A'}`);
                console.log(`     Started: ${run.createdAt.toISOString()}`);
                console.log('');
            });
        }

    } catch (error) {
        console.error('❌ Error checking reports:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkRecentReports().catch(console.error); 