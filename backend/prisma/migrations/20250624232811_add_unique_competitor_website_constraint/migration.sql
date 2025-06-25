/*
  Warnings:

  - A unique constraint covering the columns `[companyId,website]` on the table `Competitor` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Competitor_companyId_website_key" ON "Competitor"("companyId", "website");
