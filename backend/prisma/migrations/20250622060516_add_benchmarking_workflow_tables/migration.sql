-- AlterTable
ALTER TABLE "BenchmarkingQuestion" ADD COLUMN     "isGenerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalQuestionId" TEXT;

-- CreateTable
CREATE TABLE "BenchmarkResponse" (
    "id" TEXT NOT NULL,
    "benchmarkQuestionId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BenchmarkResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenchmarkMention" (
    "id" TEXT NOT NULL,
    "benchmarkResponseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "competitorId" TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BenchmarkMention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BenchmarkResponse_benchmarkQuestionId_idx" ON "BenchmarkResponse"("benchmarkQuestionId");

-- CreateIndex
CREATE INDEX "BenchmarkResponse_runId_idx" ON "BenchmarkResponse"("runId");

-- CreateIndex
CREATE INDEX "BenchmarkMention_benchmarkResponseId_idx" ON "BenchmarkMention"("benchmarkResponseId");

-- CreateIndex
CREATE INDEX "BenchmarkMention_competitorId_idx" ON "BenchmarkMention"("competitorId");

-- CreateIndex
CREATE INDEX "BenchmarkMention_companyId_idx" ON "BenchmarkMention"("companyId");

-- CreateIndex
CREATE INDEX "BenchmarkingQuestion_originalQuestionId_idx" ON "BenchmarkingQuestion"("originalQuestionId");

-- AddForeignKey
ALTER TABLE "BenchmarkingQuestion" ADD CONSTRAINT "BenchmarkingQuestion_originalQuestionId_fkey" FOREIGN KEY ("originalQuestionId") REFERENCES "BenchmarkingQuestion"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkResponse" ADD CONSTRAINT "BenchmarkResponse_benchmarkQuestionId_fkey" FOREIGN KEY ("benchmarkQuestionId") REFERENCES "BenchmarkingQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkResponse" ADD CONSTRAINT "BenchmarkResponse_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkMention" ADD CONSTRAINT "BenchmarkMention_benchmarkResponseId_fkey" FOREIGN KEY ("benchmarkResponseId") REFERENCES "BenchmarkResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkMention" ADD CONSTRAINT "BenchmarkMention_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkMention" ADD CONSTRAINT "BenchmarkMention_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
