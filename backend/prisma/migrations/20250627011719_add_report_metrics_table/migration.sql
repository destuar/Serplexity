-- CreateTable
CREATE TABLE "ReportMetric" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "aiModel" TEXT NOT NULL,
    "shareOfVoice" DOUBLE PRECISION NOT NULL,
    "shareOfVoiceChange" DOUBLE PRECISION,
    "averageInclusionRate" DOUBLE PRECISION NOT NULL,
    "averageInclusionChange" DOUBLE PRECISION,
    "averagePosition" DOUBLE PRECISION NOT NULL,
    "averagePositionChange" DOUBLE PRECISION,
    "sentimentScore" DOUBLE PRECISION,
    "sentimentChange" DOUBLE PRECISION,
    "topRankingsCount" INTEGER,
    "rankingsChange" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportMetric_companyId_aiModel_idx" ON "ReportMetric"("companyId", "aiModel");

-- CreateIndex
CREATE INDEX "ReportMetric_reportId_idx" ON "ReportMetric"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportMetric_reportId_aiModel_key" ON "ReportMetric"("reportId", "aiModel");

-- AddForeignKey
ALTER TABLE "ReportMetric" ADD CONSTRAINT "ReportMetric_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ReportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportMetric" ADD CONSTRAINT "ReportMetric_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
