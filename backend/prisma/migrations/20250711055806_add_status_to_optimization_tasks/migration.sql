-- AlterTable
ALTER TABLE "VisibilityOptimizationTask" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'NOT_STARTED';

-- CreateIndex
CREATE INDEX "VisibilityOptimizationTask_status_idx" ON "VisibilityOptimizationTask"("status");
