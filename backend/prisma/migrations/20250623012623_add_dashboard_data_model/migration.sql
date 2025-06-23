-- CreateTable
CREATE TABLE "DashboardData" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "brandShareOfVoice" JSONB NOT NULL,
    "shareOfVoiceHistory" JSONB NOT NULL,
    "averagePosition" JSONB NOT NULL,
    "averageInclusionRate" JSONB NOT NULL,
    "competitorRankings" JSONB NOT NULL,
    "topQuestions" JSONB NOT NULL,
    "sentimentOverTime" JSONB NOT NULL,

    CONSTRAINT "DashboardData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DashboardData_runId_key" ON "DashboardData"("runId");

-- CreateIndex
CREATE INDEX "DashboardData_runId_idx" ON "DashboardData"("runId");

-- CreateIndex
CREATE INDEX "DashboardData_companyId_idx" ON "DashboardData"("companyId");

-- AddForeignKey
ALTER TABLE "DashboardData" ADD CONSTRAINT "DashboardData_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
