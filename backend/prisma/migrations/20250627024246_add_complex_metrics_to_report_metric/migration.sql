-- AlterTable
ALTER TABLE "ReportMetric" ADD COLUMN     "competitorRankings" JSONB,
ADD COLUMN     "sentimentOverTime" JSONB,
ADD COLUMN     "shareOfVoiceHistory" JSONB,
ADD COLUMN     "topQuestions" JSONB;
