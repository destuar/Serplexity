-- AlterTable
ALTER TABLE "DashboardData" ADD COLUMN     "archiveAfter" TIMESTAMP(3),
ADD COLUMN     "dataVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mentionSummary" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "modelPerformance" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "questionResponseMap" JSONB NOT NULL DEFAULT '{}';

-- CreateIndex
CREATE INDEX "DashboardData_companyId_createdAt_idx" ON "DashboardData"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "DashboardData_isArchived_idx" ON "DashboardData"("isArchived");

-- CreateIndex
CREATE INDEX "DashboardData_archiveAfter_idx" ON "DashboardData"("archiveAfter");
