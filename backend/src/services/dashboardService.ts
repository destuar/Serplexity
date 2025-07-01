import prisma, { prismaReadReplica } from '../config/db';

// Raw database calculation functions to replace DashboardData
export async function calculateCompetitorRankings(runId: string, companyId: string, filters?: { aiModel?: string }) {
    // Get all competitors for this company
    const company = await prismaReadReplica.company.findUnique({
        where: { id: companyId },
        include: { competitors: true }
    });

    if (!company) {
        return { competitors: [], chartCompetitors: [], industryRanking: null, userCompany: null };
    }

    // Calculate share of voice for company and all competitors
    const entityMentionCounts = new Map<string, { name: string, isUserCompany: boolean, website?: string, mentions: number }>();
    
    // Add the user's company
    entityMentionCounts.set(companyId, {
        name: company.name,
        isUserCompany: true,
        website: company.website,
        mentions: 0
    });

    // Add all competitors
    company.competitors.forEach(competitor => {
        entityMentionCounts.set(competitor.id, {
            name: competitor.name,
            isUserCompany: false,
            website: competitor.website,
            mentions: 0
        });
    });

    // Count mentions for each entity
    const [visibilityMentions, benchmarkMentions, personalMentions] = await Promise.all([
        prismaReadReplica.visibilityMention.findMany({
            where: {
                visibilityResponse: { 
                    runId,
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                },
                OR: [
                    { companyId },
                    { competitorId: { in: company.competitors.map(c => c.id) } }
                ]
            }
        }),
        prismaReadReplica.benchmarkMention.findMany({
            where: {
                benchmarkResponse: { 
                    runId,
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                },
                OR: [
                    { companyId },
                    { competitorId: { in: company.competitors.map(c => c.id) } }
                ]
            }
        }),
        prismaReadReplica.personalMention.findMany({
            where: {
                personalResponse: { 
                    runId,
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                },
                OR: [
                    { companyId },
                    { competitorId: { in: company.competitors.map(c => c.id) } }
                ]
            }
        })
    ]);

    // Count mentions for each entity
    [...visibilityMentions, ...benchmarkMentions, ...personalMentions].forEach(mention => {
        const entityId = mention.companyId || mention.competitorId;
        if (entityId && entityMentionCounts.has(entityId)) {
            entityMentionCounts.get(entityId)!.mentions++;
        }
    });

    const totalMentions = Array.from(entityMentionCounts.values()).reduce((sum, entity) => sum + entity.mentions, 0);
    
    // Get previous completed run for comparison
    const previousRuns = await prismaReadReplica.reportRun.findMany({
        where: {
            companyId,
            status: 'COMPLETED',
            id: { not: runId }
        },
        orderBy: { createdAt: 'desc' },
        take: 1
    });

    // Calculate previous share of voice for comparison
    const previousShareOfVoice = new Map<string, number>();
    if (previousRuns.length > 0) {
        const previousRunId = previousRuns[0].id;
        
        // Get previous mention counts
        const [prevVisibilityMentions, prevBenchmarkMentions, prevPersonalMentions] = await Promise.all([
            prismaReadReplica.visibilityMention.findMany({
                where: {
                    visibilityResponse: { 
                        runId: previousRunId,
                        ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                    },
                    OR: [
                        { companyId },
                        { competitorId: { in: company.competitors.map(c => c.id) } }
                    ]
                }
            }),
            prismaReadReplica.benchmarkMention.findMany({
                where: {
                    benchmarkResponse: { 
                        runId: previousRunId,
                        ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                    },
                    OR: [
                        { companyId },
                        { competitorId: { in: company.competitors.map(c => c.id) } }
                    ]
                }
            }),
            prismaReadReplica.personalMention.findMany({
                where: {
                    personalResponse: { 
                        runId: previousRunId,
                        ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                    },
                    OR: [
                        { companyId },
                        { competitorId: { in: company.competitors.map(c => c.id) } }
                    ]
                }
            })
        ]);

        // Count previous mentions for each entity
        const prevEntityMentionCounts = new Map<string, number>();
        entityMentionCounts.forEach((_, entityId) => {
            prevEntityMentionCounts.set(entityId, 0);
        });

        [...prevVisibilityMentions, ...prevBenchmarkMentions, ...prevPersonalMentions].forEach(mention => {
            const entityId = mention.companyId || mention.competitorId;
            if (entityId && prevEntityMentionCounts.has(entityId)) {
                prevEntityMentionCounts.set(entityId, (prevEntityMentionCounts.get(entityId) || 0) + 1);
            }
        });

        const prevTotalMentions = Array.from(prevEntityMentionCounts.values()).reduce((sum, count) => sum + count, 0);
        
        // Calculate previous share of voice percentages
        if (prevTotalMentions > 0) {
            prevEntityMentionCounts.forEach((mentions, entityId) => {
                previousShareOfVoice.set(entityId, (mentions / prevTotalMentions) * 100);
            });
        }
    }
    
    // Calculate share of voice and rank entities with change data
    const rankedEntities = Array.from(entityMentionCounts.entries())
        .map(([id, entity]) => {
            const currentShareOfVoice = totalMentions > 0 ? (entity.mentions / totalMentions) * 100 : 0;
            const previousValue = previousShareOfVoice.get(id) || 0;
            const change = currentShareOfVoice - previousValue;
            
            let changeType: 'increase' | 'decrease' | 'stable';
            if (Math.abs(change) < 0.1) { // Consider changes less than 0.1% as stable
                changeType = 'stable';
            } else if (change > 0) {
                changeType = 'increase';
            } else {
                changeType = 'decrease';
            }

            return {
                id,
                name: entity.name,
                isUserCompany: entity.isUserCompany,
                website: entity.website,
                shareOfVoice: currentShareOfVoice,
                change: previousRuns.length > 0 ? change : 0,
                changeType
            };
        })
        .sort((a, b) => b.shareOfVoice - a.shareOfVoice);

    // Find user company ranking
    const userCompanyRanking = rankedEntities.findIndex(entity => entity.isUserCompany) + 1;
    const industryRanking = userCompanyRanking > 0 ? userCompanyRanking : null;

    return {
        competitors: rankedEntities.filter(entity => !entity.isUserCompany),
        chartCompetitors: rankedEntities,
        industryRanking,
        userCompany: rankedEntities.find(entity => entity.isUserCompany) || null
    };
}

export async function calculateTopQuestions(runId: string, companyId: string, filters?: { aiModel?: string }, limit?: number, skip?: number) {
    const modelFilter = filters?.aiModel && filters.aiModel !== 'all' ? { model: filters.aiModel } : {};
    
    // Fetch ALL question types with their responses and mentions
    const [visibilityQuestions, benchmarkQuestions, personalQuestions] = await Promise.all([
        // Visibility questions
        prismaReadReplica.visibilityQuestion.findMany({
            where: {
                responses: {
                    some: {
                        runId,
                        ...modelFilter,
                    },
                },
            },
            include: {
                responses: {
                    where: {
                        runId,
                        ...modelFilter,
                    },
                    include: {
                        mentions: {
                            where: {
                                companyId,
                            },
                        },
                    },
                },
                product: {
                    select: {
                        name: true,
                    },
                },
            },
        }),
        
        // Benchmark questions
        prismaReadReplica.benchmarkingQuestion.findMany({
            where: {
                companyId,
                benchmarkResponses: {
                    some: {
                        runId,
                        ...modelFilter,
                    },
                },
            },
            include: {
                benchmarkResponses: {
                    where: {
                        runId,
                        ...modelFilter,
                    },
                    include: {
                        benchmarkMentions: {
                            where: {
                                companyId,
                            },
                        },
                    },
                },
            },
        }),
        
        // Personal questions
        prismaReadReplica.personalQuestion.findMany({
            where: {
                companyId,
                responses: {
                    some: {
                        runId,
                        ...modelFilter,
                    },
                },
            },
            include: {
                responses: {
                    where: {
                        runId,
                        ...modelFilter,
                    },
                    include: {
                        mentions: {
                            where: {
                                companyId,
                            },
                        },
                    },
                },
            },
        }),
    ]);

    interface QuestionResult {
        id: string;
        question: string;
        type: 'visibility' | 'benchmark' | 'personal';
        productName?: string;
        bestPosition: number;
        totalMentions: number;
        averagePosition: number;
        bestResponse: string;
        bestResponseModel: string;
    }

    const questionResults: QuestionResult[] = [];

    // Process visibility questions
    visibilityQuestions.forEach(vq => {
        const allMentions = vq.responses.flatMap(r => r.mentions);
        
        if (allMentions.length > 0) {
            // Company IS mentioned
            const positions = allMentions.map(m => m.position);
            const bestPosition = Math.min(...positions);
            const averagePosition = positions.reduce((sum, pos) => sum + pos, 0) / positions.length;
            
            // Find the response with the best position
            let bestResponse = '';
            let bestResponseModel = '';
            let bestResponsePosition = Infinity;
            
            for (const response of vq.responses) {
                const responseMentions = response.mentions.filter(m => m.companyId === companyId);
                if (responseMentions.length > 0) {
                    const responseMinPosition = Math.min(...responseMentions.map(m => m.position));
                    if (responseMinPosition < bestResponsePosition) {
                        bestResponsePosition = responseMinPosition;
                        bestResponseModel = response.model;
                        try {
                            const parsedContent = JSON.parse(response.content);
                            bestResponse = parsedContent.answer || response.content;
                        } catch {
                            bestResponse = response.content;
                        }
                    }
                }
            }
            
            questionResults.push({
                id: vq.id,
                question: vq.question,
                type: 'visibility',
                productName: vq.product?.name,
                bestPosition,
                totalMentions: allMentions.length,
                averagePosition,
                bestResponse,
                bestResponseModel,
            });
        } else {
            // Company is NOT mentioned - still include the question
            const firstResponse = vq.responses[0];
            let responseContent = 'No response available';
            let responseModel = 'unknown';
            
            if (firstResponse) {
                responseModel = firstResponse.model;
                try {
                    const parsedContent = JSON.parse(firstResponse.content);
                    responseContent = parsedContent.answer || firstResponse.content;
                } catch {
                    responseContent = firstResponse.content;
                }
            }
            
            questionResults.push({
                id: vq.id,
                question: vq.question,
                type: 'visibility',
                productName: vq.product?.name,
                bestPosition: 999, // High number to sort non-mentioned questions to bottom
                totalMentions: 0,
                averagePosition: 999,
                bestResponse: responseContent,
                bestResponseModel: responseModel,
            });
        }
    });

    // Process benchmark questions
    benchmarkQuestions.forEach(bq => {
        const allMentions = bq.benchmarkResponses.flatMap(r => r.benchmarkMentions);
        
        if (allMentions.length > 0) {
            // Company IS mentioned
            const positions = allMentions.map(m => m.position);
            const bestPosition = Math.min(...positions);
            const averagePosition = positions.reduce((sum, pos) => sum + pos, 0) / positions.length;
            
            // Find the response with the best position
            let bestResponse = '';
            let bestResponseModel = '';
            let bestResponsePosition = Infinity;
            
            for (const response of bq.benchmarkResponses) {
                const responseMentions = response.benchmarkMentions.filter(m => m.companyId === companyId);
                if (responseMentions.length > 0) {
                    const responseMinPosition = Math.min(...responseMentions.map(m => m.position));
                    if (responseMinPosition < bestResponsePosition) {
                        bestResponsePosition = responseMinPosition;
                        bestResponseModel = response.model;
                        try {
                            const parsedContent = JSON.parse(response.content);
                            bestResponse = parsedContent.answer || response.content;
                        } catch {
                            bestResponse = response.content;
                        }
                    }
                }
            }
            
            questionResults.push({
                id: bq.id,
                question: bq.text,
                type: 'benchmark',
                bestPosition,
                totalMentions: allMentions.length,
                averagePosition,
                bestResponse,
                bestResponseModel,
            });
        } else {
            // Company is NOT mentioned - still include the question
            const firstResponse = bq.benchmarkResponses[0];
            let responseContent = 'No response available';
            let responseModel = 'unknown';
            
            if (firstResponse) {
                responseModel = firstResponse.model;
                try {
                    const parsedContent = JSON.parse(firstResponse.content);
                    responseContent = parsedContent.answer || firstResponse.content;
                } catch {
                    responseContent = firstResponse.content;
                }
            }
            
            questionResults.push({
                id: bq.id,
                question: bq.text,
                type: 'benchmark',
                bestPosition: 999,
                totalMentions: 0,
                averagePosition: 999,
                bestResponse: responseContent,
                bestResponseModel: responseModel,
            });
        }
    });

    // Process personal questions
    personalQuestions.forEach(pq => {
        const allMentions = pq.responses.flatMap(r => r.mentions);
        
        if (allMentions.length > 0) {
            // Company IS mentioned
            const positions = allMentions.map(m => m.position);
            const bestPosition = Math.min(...positions);
            const averagePosition = positions.reduce((sum, pos) => sum + pos, 0) / positions.length;
            
            // Find the response with the best position
            let bestResponse = '';
            let bestResponseModel = '';
            let bestResponsePosition = Infinity;
            
            for (const response of pq.responses) {
                const responseMentions = response.mentions.filter(m => m.companyId === companyId);
                if (responseMentions.length > 0) {
                    const responseMinPosition = Math.min(...responseMentions.map(m => m.position));
                    if (responseMinPosition < bestResponsePosition) {
                        bestResponsePosition = responseMinPosition;
                        bestResponseModel = response.model;
                        try {
                            const parsedContent = JSON.parse(response.content);
                            bestResponse = parsedContent.answer || response.content;
                        } catch {
                            bestResponse = response.content;
                        }
                    }
                }
            }
            
            questionResults.push({
                id: pq.id,
                question: pq.question,
                type: 'personal',
                bestPosition,
                totalMentions: allMentions.length,
                averagePosition,
                bestResponse,
                bestResponseModel,
            });
        } else {
            // Company is NOT mentioned - still include the question
            const firstResponse = pq.responses[0];
            let responseContent = 'No response available';
            let responseModel = 'unknown';
            
            if (firstResponse) {
                responseModel = firstResponse.model;
                try {
                    const parsedContent = JSON.parse(firstResponse.content);
                    responseContent = parsedContent.answer || firstResponse.content;
                } catch {
                    responseContent = firstResponse.content;
                }
            }
            
            questionResults.push({
                id: pq.id,
                question: pq.question,
                type: 'personal',
                bestPosition: 999,
                totalMentions: 0,
                averagePosition: 999,
                bestResponse: responseContent,
                bestResponseModel: responseModel,
            });
        }
    });

    // Sort by best position (lower is better), then by average position, then by total mentions
    questionResults.sort((a, b) => {
        if (a.bestPosition !== b.bestPosition) {
            return a.bestPosition - b.bestPosition;
        }
        if (a.averagePosition !== b.averagePosition) {
            return a.averagePosition - b.averagePosition;
        }
        return b.totalMentions - a.totalMentions;
    });

    // Apply limit and skip if provided
    let finalResults = questionResults;
    if (skip !== undefined) {
        finalResults = finalResults.slice(skip);
    }
    if (limit !== undefined) {
        finalResults = finalResults.slice(0, limit);
    }

    return finalResults;
}

export async function calculateSentimentOverTime(runId: string, companyId: string, filters?: { aiModel?: string }) {
    const aiModel = filters?.aiModel || 'all';
    console.log(`[SENTIMENT_OVER_TIME] Fetching normalized history for company ${companyId}, model ${aiModel}...`);
    
    const sentimentHistory = await prismaReadReplica.sentimentOverTime.findMany({
        where: {
            companyId,
            aiModel
        },
        orderBy: { date: 'asc' },
        select: {
            date: true,
            sentimentScore: true
        }
    });

    // Format for chart display
    return sentimentHistory.map(item => ({
        date: item.date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        }),
        score: item.sentimentScore
    }));
}

export async function calculateShareOfVoiceHistory(runId: string, companyId: string, filters?: { aiModel?: string }) {
    const aiModel = filters?.aiModel || 'all';
    console.log(`[SHARE_OF_VOICE_HISTORY] Fetching normalized history for company ${companyId}, model ${aiModel}...`);
    
    const shareOfVoiceHistory = await prismaReadReplica.shareOfVoiceHistory.findMany({
        where: {
            companyId,
            aiModel
        },
        orderBy: { date: 'asc' },
        select: {
            date: true,
            shareOfVoice: true
        }
    });

    // Format for chart display
    return shareOfVoiceHistory.map(item => ({
        date: item.date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        }),
        shareOfVoice: item.shareOfVoice
    }));
}

// New utility functions to save data to normalized tables
export async function saveShareOfVoiceHistoryPoint(
    companyId: string,
    date: Date,
    aiModel: string,
    shareOfVoice: number,
    reportRunId?: string
): Promise<void> {
    if (!reportRunId) {
        console.warn(`[saveShareOfVoiceHistoryPoint] reportRunId is missing for company ${companyId}. Skipping save.`);
        return;
    }
    // Normalize date to day precision
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    await prisma.shareOfVoiceHistory.upsert({
        where: {
            companyId_date_aiModel: {
                companyId,
                date: normalizedDate,
                aiModel
            }
        },
        update: {
            shareOfVoice,
            reportRunId,
            updatedAt: new Date()
        },
        create: {
            companyId,
            date: normalizedDate,
            aiModel,
            shareOfVoice,
            reportRunId
        }
    });
}

export async function saveSentimentOverTimePoint(
    companyId: string,
    date: Date,
    aiModel: string,
    sentimentScore: number,
    reportRunId?: string
): Promise<void> {
    if (!reportRunId) {
        console.warn(`[saveSentimentOverTimePoint] reportRunId is missing for company ${companyId}. Skipping save.`);
        return;
    }
    // Normalize date to day precision
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    await prisma.sentimentOverTime.upsert({
        where: {
            companyId_date_aiModel: {
                companyId,
                date: normalizedDate,
                aiModel
            }
        },
        update: {
            sentimentScore,
            reportRunId,
            updatedAt: new Date()
        },
        create: {
            companyId,
            date: normalizedDate,
            aiModel,
            sentimentScore,
            reportRunId
        }
    });
} 