-- Clean Schema Migration: Remove fanout system and create clean research-based models
-- This migration removes the complex fanout system and replaces it with clean, simple models

-- First, drop all fanout-related tables
DROP TABLE IF EXISTS "FanoutCitation" CASCADE;
DROP TABLE IF EXISTS "FanoutMention" CASCADE;
DROP TABLE IF EXISTS "FanoutResponse" CASCADE;
DROP TABLE IF EXISTS "FanoutQuestion" CASCADE;
DROP TABLE IF EXISTS "BenchmarkingQuestion" CASCADE;

-- Create clean Question model
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'research',
    "companyId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- Create clean Response model
CREATE TABLE "Response" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- Create clean Mention model  
CREATE TABLE "Mention" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "companyId" TEXT,
    "competitorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);

-- Create clean Citation model
CREATE TABLE "Citation" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "accessedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Citation_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "Question" ADD CONSTRAINT "Question_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Response" ADD CONSTRAINT "Response_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Response" ADD CONSTRAINT "Response_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Mention" ADD CONSTRAINT "Mention_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Citation" ADD CONSTRAINT "Citation_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for performance
CREATE INDEX "Question_companyId_idx" ON "Question"("companyId");
CREATE INDEX "Question_runId_idx" ON "Question"("runId");
CREATE INDEX "Question_type_idx" ON "Question"("type");

CREATE INDEX "Response_questionId_idx" ON "Response"("questionId");
CREATE INDEX "Response_runId_idx" ON "Response"("runId");
CREATE INDEX "Response_model_idx" ON "Response"("model");
CREATE INDEX "Response_engine_idx" ON "Response"("engine");

CREATE INDEX "Mention_responseId_idx" ON "Mention"("responseId");
CREATE INDEX "Mention_companyId_idx" ON "Mention"("companyId");
CREATE INDEX "Mention_competitorId_idx" ON "Mention"("competitorId");
CREATE INDEX "Mention_responseId_companyId_idx" ON "Mention"("responseId", "companyId");
CREATE INDEX "Mention_responseId_competitorId_idx" ON "Mention"("responseId", "competitorId");

CREATE INDEX "Citation_responseId_idx" ON "Citation"("responseId");
CREATE INDEX "Citation_domain_idx" ON "Citation"("domain");
CREATE INDEX "Citation_url_idx" ON "Citation"("url");
CREATE INDEX "Citation_responseId_position_idx" ON "Citation"("responseId", "position");

-- Remove fanout references from Company table (these will be handled by schema.prisma update)
-- The actual column removal will be handled by the Prisma schema update