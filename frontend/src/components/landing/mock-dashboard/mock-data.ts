export const mockReportMetric = {
  shareOfVoice: 38.5,
  shareOfVoiceChange: 2.1,
  averageInclusionRate: 72.3,
  averageInclusionChange: -1.5,
  averagePosition: 2.1,
  averagePositionChange: 0.2,
  sentimentScore: 8.5,
  sentimentChange: 0.3,
  topRankingsCount: 15,
  rankingsChange: 3,
  sentimentDetails: {
    "Quality": { score: 9.2, change: 0.5 },
    "Value": { score: 8.8, change: -0.2 },
    "Customer Service": { score: 7.5, change: 1.1 },
    "Innovation": { score: 8.9, change: 0.1 },
    "Trust": { score: 8.2, change: 0.4 },
  },
  competitorRankings: [
    { rank: 1, name: 'Serplexity', website: 'serplexity.com', shareOfVoice: 38.5, inclusionRate: 72.3, avgPosition: 2.1 },
    { rank: 2, name: 'Competitor A', website: 'competitora.com', shareOfVoice: 25.2, inclusionRate: 65.1, avgPosition: 2.8 },
    { rank: 3, name: 'Competitor B', website: 'competitorb.com', shareOfVoice: 18.9, inclusionRate: 50.7, avgPosition: 3.5 },
    { rank: 4, name: 'Competitor C', website: 'competitorc.com', shareOfVoice: 10.1, inclusionRate: 40.2, avgPosition: 4.1 },
    { rank: 5, name: 'Competitor D', website: 'competitord.com', shareOfVoice: 7.3, inclusionRate: 35.5, avgPosition: 4.9 },
  ],
  topQuestions: [
    { 
      question: "What is the best tool for AI visibility tracking?", 
      yourPosition: 1, 
      mentions: ["Serplexity", "Competitor A"],
      inclusionRate: 85,
    },
    { 
      question: "How to improve citations in Google AI Overviews?", 
      yourPosition: 2, 
      mentions: ["Competitor B", "Serplexity", "Competitor A"],
      inclusionRate: 70,
    },
    { 
      question: "Serplexity vs Competitor A for enterprise?", 
      yourPosition: 1, 
      mentions: ["Serplexity"],
      inclusionRate: 95,
    },
    { 
      question: "Price of generative engine optimization tools", 
      yourPosition: 3, 
      mentions: ["Competitor C", "Competitor A", "Serplexity"],
      inclusionRate: 60,
    }
  ],
  sentimentOverTime: [
    { date: '2025-05-01', score: 8.1 },
    { date: '2025-05-08', score: 8.3 },
    { date: '2025-05-15', score: 8.2 },
    { date: '2025-05-22', score: 8.4 },
    { date: '2025-05-29', score: 8.5 },
  ],
  shareOfVoiceHistory: [
    { date: '2025-05-01', value: 35.2 },
    { date: '2025-05-08', value: 36.1 },
    { date: '2025-05-15', value: 37.8 },
    { date: '2025-05-22', value: 36.4 },
    { date: '2025-05-29', value: 38.5 },
  ],
};

export const MOCK_COMPANY_PROFILE = {
  name: 'Serplexity',
  website: 'serplexity.com',
  logo: '/Serplexity.png'
};

export type MockReportMetric = typeof mockReportMetric;