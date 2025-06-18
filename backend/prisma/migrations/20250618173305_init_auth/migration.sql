/*
  Warnings:

  - You are about to drop the `answers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `citations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `clients` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `gap_index` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `metrics_daily` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `queries` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `traffic_sessions` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- DropForeignKey
ALTER TABLE "answers" DROP CONSTRAINT "answers_query_id_fkey";

-- DropForeignKey
ALTER TABLE "citations" DROP CONSTRAINT "citations_answer_id_fkey";

-- DropForeignKey
ALTER TABLE "gap_index" DROP CONSTRAINT "gap_index_query_id_fkey";

-- DropForeignKey
ALTER TABLE "metrics_daily" DROP CONSTRAINT "metrics_daily_query_id_fkey";

-- DropForeignKey
ALTER TABLE "queries" DROP CONSTRAINT "queries_client_id_fkey";

-- DropForeignKey
ALTER TABLE "traffic_sessions" DROP CONSTRAINT "traffic_sessions_client_id_fkey";

-- DropTable
DROP TABLE "answers";

-- DropTable
DROP TABLE "citations";

-- DropTable
DROP TABLE "clients";

-- DropTable
DROP TABLE "gap_index";

-- DropTable
DROP TABLE "metrics_daily";

-- DropTable
DROP TABLE "queries";

-- DropTable
DROP TABLE "traffic_sessions";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "provider" TEXT NOT NULL DEFAULT 'credentials',
    "providerId" TEXT,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
