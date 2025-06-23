/*
  Warnings:

  - Made the column `website` on table `Company` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Company" ALTER COLUMN "website" SET NOT NULL;
