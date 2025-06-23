-- CreateTable
CREATE TABLE "VisibilityResponse" (
    "id" TEXT NOT NULL,
    "visibilityQuestionId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisibilityResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mention" (
    "id" TEXT NOT NULL,
    "visibilityResponseId" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisibilityResponse_visibilityQuestionId_idx" ON "VisibilityResponse"("visibilityQuestionId");

-- CreateIndex
CREATE INDEX "VisibilityResponse_runId_idx" ON "VisibilityResponse"("runId");

-- CreateIndex
CREATE INDEX "Mention_visibilityResponseId_idx" ON "Mention"("visibilityResponseId");

-- CreateIndex
CREATE INDEX "Mention_competitorId_idx" ON "Mention"("competitorId");

-- AddForeignKey
ALTER TABLE "VisibilityResponse" ADD CONSTRAINT "VisibilityResponse_visibilityQuestionId_fkey" FOREIGN KEY ("visibilityQuestionId") REFERENCES "VisibilityQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisibilityResponse" ADD CONSTRAINT "VisibilityResponse_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_visibilityResponseId_fkey" FOREIGN KEY ("visibilityResponseId") REFERENCES "VisibilityResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
