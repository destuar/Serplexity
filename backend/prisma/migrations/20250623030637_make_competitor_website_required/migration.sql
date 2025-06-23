/*
  Warnings:

  - Made the column `website` on table `Competitor` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Competitor" ALTER COLUMN "website" SET NOT NULL;
