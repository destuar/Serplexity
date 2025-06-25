/*
  Warnings:

  - You are about to drop the `DashboardData` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DashboardData" DROP CONSTRAINT "DashboardData_runId_fkey";

-- DropTable
DROP TABLE "DashboardData";
