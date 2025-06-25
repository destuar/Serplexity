-- CreateTable
CREATE TABLE "PersonalQuestion" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalResponse" (
    "id" TEXT NOT NULL,
    "personalQuestionId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalMention" (
    "id" TEXT NOT NULL,
    "personalResponseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "competitorId" TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalMention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalQuestion_companyId_idx" ON "PersonalQuestion"("companyId");

-- CreateIndex
CREATE INDEX "PersonalResponse_personalQuestionId_idx" ON "PersonalResponse"("personalQuestionId");

-- CreateIndex
CREATE INDEX "PersonalResponse_runId_idx" ON "PersonalResponse"("runId");

-- CreateIndex
CREATE INDEX "PersonalMention_personalResponseId_idx" ON "PersonalMention"("personalResponseId");

-- CreateIndex
CREATE INDEX "PersonalMention_competitorId_idx" ON "PersonalMention"("competitorId");

-- CreateIndex
CREATE INDEX "PersonalMention_companyId_idx" ON "PersonalMention"("companyId");

-- AddForeignKey
ALTER TABLE "PersonalQuestion" ADD CONSTRAINT "PersonalQuestion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalResponse" ADD CONSTRAINT "PersonalResponse_personalQuestionId_fkey" FOREIGN KEY ("personalQuestionId") REFERENCES "PersonalQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalResponse" ADD CONSTRAINT "PersonalResponse_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalMention" ADD CONSTRAINT "PersonalMention_personalResponseId_fkey" FOREIGN KEY ("personalResponseId") REFERENCES "PersonalResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalMention" ADD CONSTRAINT "PersonalMention_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalMention" ADD CONSTRAINT "PersonalMention_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
