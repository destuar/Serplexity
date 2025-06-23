/*
  Warnings:

  - You are about to drop the `Mention` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Mention" DROP CONSTRAINT "Mention_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Mention" DROP CONSTRAINT "Mention_competitorId_fkey";

-- DropForeignKey
ALTER TABLE "Mention" DROP CONSTRAINT "Mention_visibilityResponseId_fkey";

-- DropTable
DROP TABLE "Mention";

-- CreateTable
CREATE TABLE "VisibilityMention" (
    "id" TEXT NOT NULL,
    "visibilityResponseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "competitorId" TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisibilityMention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisibilityMention_visibilityResponseId_idx" ON "VisibilityMention"("visibilityResponseId");

-- CreateIndex
CREATE INDEX "VisibilityMention_competitorId_idx" ON "VisibilityMention"("competitorId");

-- CreateIndex
CREATE INDEX "VisibilityMention_companyId_idx" ON "VisibilityMention"("companyId");

-- AddForeignKey
ALTER TABLE "VisibilityMention" ADD CONSTRAINT "VisibilityMention_visibilityResponseId_fkey" FOREIGN KEY ("visibilityResponseId") REFERENCES "VisibilityResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisibilityMention" ADD CONSTRAINT "VisibilityMention_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisibilityMention" ADD CONSTRAINT "VisibilityMention_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
