import { prismaReadReplica } from '../config/db';

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
    // --- NEW IMPLEMENTATION: aggregate sentiment scores across all completed runs for the company ---

    // 1. Find all completed runs for this company
    const runs = await prismaReadReplica.reportRun.findMany({
        where: {
            companyId,
            status: 'COMPLETED'
        },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'asc' }
    });

    if (runs.length === 0) {
        return [];
    }

    const runIds = runs.map(r => r.id);
    const runDateMap = new Map(runs.map(r => [r.id, r.createdAt]));

    // 2. Grab all sentiment metrics for those runs (optionally engine-filtered)
    const sentimentMetrics = await prismaReadReplica.sentimentScore.findMany({
        where: {
            runId: { in: runIds },
            name: 'Detailed Sentiment Scores',
            ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
        }
    });

    if (sentimentMetrics.length === 0) {
        return [];
    }

    // 3. Group by calendar day and average scores
    const sentimentByDate: { [date: string]: { scores: number[]; count: number } } = {};

    sentimentMetrics.forEach(metric => {
        if (!metric.runId) return;

        const value = metric.value as any;
        if (!value?.ratings?.[0]) return;

        const rating = value.ratings[0];
        const categoryScores = Object.values(rating).filter(v => typeof v === 'number') as number[];
        if (categoryScores.length === 0) return;

        const averageScore = categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length;

        const runDate = runDateMap.get(metric.runId);
        if (!runDate) return;

        const date = new Date(runDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        if (!sentimentByDate[date]) {
            sentimentByDate[date] = { scores: [], count: 0 };
        }
        sentimentByDate[date].scores.push(averageScore);
        sentimentByDate[date].count++;
    });

    // 4. Convert to chart format sorted chronologically
    return Object.entries(sentimentByDate)
        .map(([date, data]) => ({
            date,
            score: data.scores.reduce((sum, s) => sum + s, 0) / data.count
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function calculateShareOfVoiceHistory(runId: string, companyId: string, filters?: { aiModel?: string }) {
    // --- NEW IMPLEMENTATION: aggregate share-of-voice across all completed runs for the company ---

    // 1. Fetch company and competitors
    const company = await prismaReadReplica.company.findUnique({
        where: { id: companyId },
        include: { competitors: true }
    });

    if (!company) {
        return [];
    }
    const competitorIds = company.competitors.map(c => c.id);

    // 2. Fetch all completed run IDs for this company, and map their dates
    const runs = await prismaReadReplica.reportRun.findMany({
        where: {
            companyId,
            status: 'COMPLETED'
        },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'asc' }
    });

    if (runs.length === 0) {
        return [];
    }

    const runIds = runs.map(r => r.id);
    const runDateMap = new Map(runs.map(r => [r.id, r.createdAt]));

    // 3. Gather mentions across all response types for those runs
    const mentionWhereClause = {
        OR: [
            { companyId: companyId },
            { competitorId: { in: competitorIds } }
        ]
    };

    const [visibilityMentions, benchmarkMentions, personalMentions] = await Promise.all([
        prismaReadReplica.visibilityMention.findMany({
            where: {
                visibilityResponse: {
                    runId: { in: runIds },
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                },
                ...mentionWhereClause
            },
            select: { visibilityResponse: { select: { runId: true } }, companyId: true, competitorId: true }
        }),
        prismaReadReplica.benchmarkMention.findMany({
            where: {
                benchmarkResponse: {
                    runId: { in: runIds },
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                },
                ...mentionWhereClause
            },
            select: { benchmarkResponse: { select: { runId: true } }, companyId: true, competitorId: true }
        }),
        prismaReadReplica.personalMention.findMany({
            where: {
                personalResponse: {
                    runId: { in: runIds },
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                },
                ...mentionWhereClause
            },
            select: { personalResponse: { select: { runId: true } }, companyId: true, competitorId: true }
        })
    ]);

    const allMentions = [
        ...visibilityMentions.map(m => ({ ...m, runId: m.visibilityResponse?.runId })),
        ...benchmarkMentions.map(m => ({ ...m, runId: m.benchmarkResponse?.runId })),
        ...personalMentions.map(m => ({ ...m, runId: m.personalResponse?.runId }))
    ];

    if (allMentions.length === 0) {
        return [];
    }

    // 4. Group by calendar day and compute SOV
    const mentionsByDate: { [date: string]: { companyMentions: number; totalMentions: number } } = {};

    allMentions.forEach(mention => {
        if (!mention.runId) return;
        const runDate = runDateMap.get(mention.runId);
        if (!runDate) return;
        
        const date = new Date(runDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        if (!mentionsByDate[date]) {
            mentionsByDate[date] = { companyMentions: 0, totalMentions: 0 };
        }
        mentionsByDate[date].totalMentions++;
        if (mention.companyId === companyId) {
            mentionsByDate[date].companyMentions++;
        }
    });

    // 5. Convert to chart format sorted chronologically
    return Object.entries(mentionsByDate)
        .map(([date, data]) => ({
            date,
            shareOfVoice: data.totalMentions > 0 ? (data.companyMentions / data.totalMentions) * 100 : 0
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
} 