/*
  Warnings:

  - You are about to drop the column `isGenerated` on the `BenchmarkingQuestion` table. All the data in the column will be lost.
  - You are about to drop the column `originalQuestionId` on the `BenchmarkingQuestion` table. All the data in the column will be lost.
  - You are about to drop the column `sentimentOverTime` on the `ReportMetric` table. All the data in the column will be lost.
  - You are about to drop the column `shareOfVoiceHistory` on the `ReportMetric` table. All the data in the column will be lost.
  - You are about to drop the `BenchmarkMention` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BenchmarkResponse` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PersonalMention` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PersonalQuestion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PersonalResponse` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Product` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VisibilityMention` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VisibilityQuestion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VisibilityResponse` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[website]` on the table `Company` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "BenchmarkMention" DROP CONSTRAINT "BenchmarkMention_benchmarkResponseId_fkey";

-- DropForeignKey
ALTER TABLE "BenchmarkMention" DROP CONSTRAINT "BenchmarkMention_companyId_fkey";

-- DropForeignKey
ALTER TABLE "BenchmarkMention" DROP CONSTRAINT "BenchmarkMention_competitorId_fkey";

-- DropForeignKey
ALTER TABLE "BenchmarkResponse" DROP CONSTRAINT "BenchmarkResponse_benchmarkQuestionId_fkey";

-- DropForeignKey
ALTER TABLE "BenchmarkResponse" DROP CONSTRAINT "BenchmarkResponse_runId_fkey";

-- DropForeignKey
ALTER TABLE "BenchmarkingQuestion" DROP CONSTRAINT "BenchmarkingQuestion_originalQuestionId_fkey";

-- DropForeignKey
ALTER TABLE "PersonalMention" DROP CONSTRAINT "PersonalMention_companyId_fkey";

-- DropForeignKey
ALTER TABLE "PersonalMention" DROP CONSTRAINT "PersonalMention_competitorId_fkey";

-- DropForeignKey
ALTER TABLE "PersonalMention" DROP CONSTRAINT "PersonalMention_personalResponseId_fkey";

-- DropForeignKey
ALTER TABLE "PersonalQuestion" DROP CONSTRAINT "PersonalQuestion_companyId_fkey";

-- DropForeignKey
ALTER TABLE "PersonalResponse" DROP CONSTRAINT "PersonalResponse_personalQuestionId_fkey";

-- DropForeignKey
ALTER TABLE "PersonalResponse" DROP CONSTRAINT "PersonalResponse_runId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_companyId_fkey";

-- DropForeignKey
ALTER TABLE "VisibilityMention" DROP CONSTRAINT "VisibilityMention_companyId_fkey";

-- DropForeignKey
ALTER TABLE "VisibilityMention" DROP CONSTRAINT "VisibilityMention_competitorId_fkey";

-- DropForeignKey
ALTER TABLE "VisibilityMention" DROP CONSTRAINT "VisibilityMention_visibilityResponseId_fkey";

-- DropForeignKey
ALTER TABLE "VisibilityQuestion" DROP CONSTRAINT "VisibilityQuestion_productId_fkey";

-- DropForeignKey
ALTER TABLE "VisibilityResponse" DROP CONSTRAINT "VisibilityResponse_runId_fkey";

-- DropForeignKey
ALTER TABLE "VisibilityResponse" DROP CONSTRAINT "VisibilityResponse_visibilityQuestionId_fkey";

-- DropIndex
DROP INDEX "BenchmarkingQuestion_originalQuestionId_idx";

-- DropIndex
DROP INDEX "ReportMetric_companyId_aiModel_idx";

-- DropIndex
DROP INDEX "ReportMetric_reportId_idx";

-- AlterTable
ALTER TABLE "BenchmarkingQuestion" DROP COLUMN "isGenerated",
DROP COLUMN "originalQuestionId";

-- AlterTable
ALTER TABLE "ReportMetric" DROP COLUMN "sentimentOverTime",
DROP COLUMN "shareOfVoiceHistory",
ALTER COLUMN "rankingsChange" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ReportRun" ADD COLUMN     "aiVisibilitySummary" TEXT,
ADD COLUMN     "fanoutData" JSONB;

-- DropTable
DROP TABLE "BenchmarkMention";

-- DropTable
DROP TABLE "BenchmarkResponse";

-- DropTable
DROP TABLE "PersonalMention";

-- DropTable
DROP TABLE "PersonalQuestion";

-- DropTable
DROP TABLE "PersonalResponse";

-- DropTable
DROP TABLE "Product";

-- DropTable
DROP TABLE "VisibilityMention";

-- DropTable
DROP TABLE "VisibilityQuestion";

-- DropTable
DROP TABLE "VisibilityResponse";

-- CreateTable
CREATE TABLE "FanoutQuestion" (
    "id" TEXT NOT NULL,
    "baseQuestionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sourceModel" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FanoutQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FanoutResponse" (
    "id" TEXT NOT NULL,
    "fanoutQuestionId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FanoutResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FanoutMention" (
    "id" TEXT NOT NULL,
    "fanoutResponseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "competitorId" TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FanoutMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareOfVoiceHistory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "aiModel" TEXT NOT NULL,
    "shareOfVoice" DOUBLE PRECISION NOT NULL,
    "reportRunId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareOfVoiceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentimentOverTime" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "aiModel" TEXT NOT NULL,
    "sentimentScore" DOUBLE PRECISION NOT NULL,
    "reportRunId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SentimentOverTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisibilityOptimizationTask" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "reportRunId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "impactMetric" TEXT NOT NULL,
    "dependencies" JSONB NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisibilityOptimizationTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FanoutQuestion_baseQuestionId_idx" ON "FanoutQuestion"("baseQuestionId");

-- CreateIndex
CREATE INDEX "FanoutQuestion_companyId_idx" ON "FanoutQuestion"("companyId");

-- CreateIndex
CREATE INDEX "FanoutQuestion_type_idx" ON "FanoutQuestion"("type");

-- CreateIndex
CREATE INDEX "FanoutQuestion_sourceModel_idx" ON "FanoutQuestion"("sourceModel");

-- CreateIndex
CREATE INDEX "FanoutResponse_fanoutQuestionId_idx" ON "FanoutResponse"("fanoutQuestionId");

-- CreateIndex
CREATE INDEX "FanoutResponse_runId_idx" ON "FanoutResponse"("runId");

-- CreateIndex
CREATE INDEX "FanoutResponse_engine_idx" ON "FanoutResponse"("engine");

-- CreateIndex
CREATE INDEX "FanoutResponse_model_idx" ON "FanoutResponse"("model");

-- CreateIndex
CREATE INDEX "FanoutMention_fanoutResponseId_idx" ON "FanoutMention"("fanoutResponseId");

-- CreateIndex
CREATE INDEX "FanoutMention_competitorId_idx" ON "FanoutMention"("competitorId");

-- CreateIndex
CREATE INDEX "FanoutMention_companyId_idx" ON "FanoutMention"("companyId");

-- CreateIndex
CREATE INDEX "FanoutMention_fanoutResponseId_companyId_idx" ON "FanoutMention"("fanoutResponseId", "companyId");

-- CreateIndex
CREATE INDEX "FanoutMention_fanoutResponseId_competitorId_idx" ON "FanoutMention"("fanoutResponseId", "competitorId");

-- CreateIndex
CREATE INDEX "ShareOfVoiceHistory_companyId_aiModel_idx" ON "ShareOfVoiceHistory"("companyId", "aiModel");

-- CreateIndex
CREATE UNIQUE INDEX "ShareOfVoiceHistory_companyId_date_aiModel_key" ON "ShareOfVoiceHistory"("companyId", "date", "aiModel");

-- CreateIndex
CREATE INDEX "SentimentOverTime_companyId_aiModel_idx" ON "SentimentOverTime"("companyId", "aiModel");

-- CreateIndex
CREATE UNIQUE INDEX "SentimentOverTime_companyId_date_aiModel_key" ON "SentimentOverTime"("companyId", "date", "aiModel");

-- CreateIndex
CREATE INDEX "VisibilityOptimizationTask_companyId_idx" ON "VisibilityOptimizationTask"("companyId");

-- CreateIndex
CREATE INDEX "VisibilityOptimizationTask_reportRunId_idx" ON "VisibilityOptimizationTask"("reportRunId");

-- CreateIndex
CREATE UNIQUE INDEX "VisibilityOptimizationTask_reportRunId_taskId_key" ON "VisibilityOptimizationTask"("reportRunId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_website_key" ON "Company"("website");

-- CreateIndex
CREATE INDEX "ReportMetric_companyId_idx" ON "ReportMetric"("companyId");

-- AddForeignKey
ALTER TABLE "FanoutQuestion" ADD CONSTRAINT "FanoutQuestion_baseQuestionId_fkey" FOREIGN KEY ("baseQuestionId") REFERENCES "BenchmarkingQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanoutQuestion" ADD CONSTRAINT "FanoutQuestion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanoutResponse" ADD CONSTRAINT "FanoutResponse_fanoutQuestionId_fkey" FOREIGN KEY ("fanoutQuestionId") REFERENCES "FanoutQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanoutResponse" ADD CONSTRAINT "FanoutResponse_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanoutMention" ADD CONSTRAINT "FanoutMention_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanoutMention" ADD CONSTRAINT "FanoutMention_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanoutMention" ADD CONSTRAINT "FanoutMention_fanoutResponseId_fkey" FOREIGN KEY ("fanoutResponseId") REFERENCES "FanoutResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareOfVoiceHistory" ADD CONSTRAINT "ShareOfVoiceHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareOfVoiceHistory" ADD CONSTRAINT "ShareOfVoiceHistory_reportRunId_fkey" FOREIGN KEY ("reportRunId") REFERENCES "ReportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentimentOverTime" ADD CONSTRAINT "SentimentOverTime_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentimentOverTime" ADD CONSTRAINT "SentimentOverTime_reportRunId_fkey" FOREIGN KEY ("reportRunId") REFERENCES "ReportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisibilityOptimizationTask" ADD CONSTRAINT "VisibilityOptimizationTask_reportRunId_fkey" FOREIGN KEY ("reportRunId") REFERENCES "ReportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisibilityOptimizationTask" ADD CONSTRAINT "VisibilityOptimizationTask_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
