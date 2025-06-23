/*
  Warnings:

  - Added the required column `updatedAt` to the `Mention` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `VisibilityResponse` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Mention" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "competitorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "VisibilityResponse" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Mention_companyId_idx" ON "Mention"("companyId");

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
