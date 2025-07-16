#!/usr/bin/env ts-node

import { getDbClient } from '../config/database';

async function checkCompanies() {
  const prisma = await getDbClient();
    console.log('🏢 Checking companies for report scheduling...\n');
    
    try {
        // Get all companies
        const allCompanies = await prisma.company.findMany({
            select: {
                id: true,
                name: true,
                createdAt: true,
                _count: {
                    select: {
                        runs: true
                    }
                }
            }
        });

        console.log(`📊 Total companies: ${allCompanies.length}`);
        
        if (allCompanies.length === 0) {
            console.log('❌ No companies found in database');
            return;
        }

        // Check companies with completed runs (eligible for scheduler)
        const eligibleCompanies = await prisma.company.findMany({
            where: {
                runs: {
                    some: {
                        status: 'COMPLETED',
                    },
                },
            },
            select: {
                id: true,
                name: true,
                runs: {
                    where: {
                        status: 'COMPLETED'
                    },
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 1,
                    select: {
                        id: true,
                        status: true,
                        createdAt: true
                    }
                }
            }
        });

        console.log(`✅ Companies eligible for scheduling: ${eligibleCompanies.length}`);
        
        if (eligibleCompanies.length === 0) {
            console.log('❌ No companies have completed reports yet');
            console.log('💡 The scheduler only processes companies with at least one completed report');
        } else {
            console.log('\n📋 Eligible companies:');
            eligibleCompanies.forEach((company, index) => {
                const lastRun = company.runs[0];
                console.log(`  ${index + 1}. ${company.name}`);
                console.log(`     ID: ${company.id}`);
                console.log(`     Last completed run: ${lastRun.createdAt.toISOString()}`);
                console.log('');
            });
        }

        // Check for any runs today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayRuns = await prisma.reportRun.findMany({
            where: {
                createdAt: {
                    gte: today
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

        console.log(`📅 Report runs today: ${todayRuns.length}`);
        if (todayRuns.length > 0) {
            todayRuns.forEach((run, index) => {
                console.log(`  ${index + 1}. ${run.company.name} - ${run.status}`);
                console.log(`     Created: ${run.createdAt.toISOString()}`);
                console.log('');
            });
        }

    } catch (error) {
        console.error('❌ Error checking companies:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkCompanies().catch(console.error); 