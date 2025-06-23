import { getLatestReport } from './reportService';
import { getShareOfVoice, getCompetitorRankings, getTopRankingQuestions, getShareOfVoiceHistory, getAverageInclusionRate, getAveragePosition, getSentimentOverTime } from './companyService';
import { DashboardData, DashboardFilters } from '../types/dashboard';

export const getDashboardData = async (companyId: string, filters: DashboardFilters): Promise<DashboardData | null> => {
  // This is a temporary solution to consolidate data fetching on the frontend.
  // Ideally, the backend should provide a single endpoint for all dashboard data.

  try {
    const [reportData, shareOfVoiceData, competitorRankingsData, topQuestionsData, shareOfVoiceHistoryData, averageInclusionRateData, averagePositionData, sentimentOverTimeData] = await Promise.all([
      getLatestReport(companyId, filters),
      getShareOfVoice(companyId, filters),
      getCompetitorRankings(companyId, filters),
      getTopRankingQuestions(companyId, { aiModel: filters.aiModel }),
      getShareOfVoiceHistory(companyId, filters),
      getAverageInclusionRate(companyId, filters),
      getAveragePosition(companyId, filters),
      getSentimentOverTime(companyId, filters),
    ]);

    // Combine the data into a single object with proper type handling
    const combinedData: DashboardData = {
      ...reportData,
      brandShareOfVoice: { shareOfVoice: shareOfVoiceData.shareOfVoice ?? 0 },
      competitorRankings: competitorRankingsData,
      topQuestions: topQuestionsData.questions,
      shareOfVoiceHistory: shareOfVoiceHistoryData.history || [],
      averageInclusionRate: { 
        averageInclusionRate: averageInclusionRateData.averageInclusionRate ?? 0, 
        change: averageInclusionRateData.change ?? 0 
      },
      averagePosition: { 
        averagePosition: averagePositionData.averagePosition ?? 0, 
        change: averagePositionData.change ?? 0 
      },
      sentimentOverTime: sentimentOverTimeData.history || [],
      lastUpdated: reportData.lastUpdated || new Date().toISOString(),
      metrics: reportData.metrics || [],
    };

    return combinedData;
  } catch (error: unknown) {
    // If the main report endpoint returns 404, it means no report exists yet
    // In this case, return null so the WelcomePrompt shows
    const apiError = error as { response?: { status?: number }; message?: string };
    if (apiError?.response?.status === 404 || apiError?.message?.includes('404')) {
      console.log('No report data found for new company, showing welcome prompt');
      return null;
    }
    
    // For other errors, return fallback data to prevent crashes
    console.warn('Dashboard API calls failed with non-404 error, returning fallback data:', error);
    
    return {
      brandShareOfVoice: { shareOfVoice: 0 },
      competitorRankings: { competitors: [], chartCompetitors: [], industryRanking: null, userCompany: null },
      topQuestions: [],
      shareOfVoiceHistory: [],
      averageInclusionRate: { averageInclusionRate: 0, change: 0 },
      averagePosition: { averagePosition: 0, change: 0 },
      sentimentOverTime: [],
      lastUpdated: new Date().toISOString(),
      metrics: [],
    };
  }
}; 