/*
  Warnings:

  - You are about to drop the column `runId` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `text` on the `Question` table. All the data in the column will be lost.
  - The `sentimentScore` column on the `ReportMetric` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `fanoutData` on the `ReportRun` table. All the data in the column will be lost.
  - Added the required column `query` to the `Question` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Question" DROP CONSTRAINT "Question_runId_fkey";

-- DropIndex
DROP INDEX "Question_runId_idx";

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "questionsReady" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Competitor" ADD COLUMN     "isAccepted" BOOLEAN;

-- AlterTable
ALTER TABLE "Question" DROP COLUMN "runId",
DROP COLUMN "text",
ADD COLUMN     "intent" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "query" TEXT NOT NULL,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'user',
ALTER COLUMN "type" DROP NOT NULL,
ALTER COLUMN "type" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ReportMetric" DROP COLUMN "sentimentScore",
ADD COLUMN     "sentimentScore" JSONB;

-- AlterTable
ALTER TABLE "ReportRun" DROP COLUMN "fanoutData";

-- CreateTable
CREATE TABLE "CompanyQuestion" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyQuestion_companyId_idx" ON "CompanyQuestion"("companyId");

-- CreateIndex
CREATE INDEX "CompanyQuestion_isActive_idx" ON "CompanyQuestion"("isActive");

-- CreateIndex
CREATE INDEX "Question_isActive_idx" ON "Question"("isActive");

-- CreateIndex
CREATE INDEX "Question_source_idx" ON "Question"("source");

-- CreateIndex
CREATE INDEX "Question_intent_idx" ON "Question"("intent");

-- AddForeignKey
ALTER TABLE "CompanyQuestion" ADD CONSTRAINT "CompanyQuestion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
