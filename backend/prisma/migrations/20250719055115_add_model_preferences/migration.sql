-- AlterTable
ALTER TABLE "User" ADD COLUMN     "modelPreferences" JSONB DEFAULT '{"gpt-4.1-mini":true,"claude-3-5-haiku-20241022":true,"gemini-2.5-flash":true,"sonar":true}';

-- CreateTable
CREATE TABLE "FanoutCitation" (
    "id" TEXT NOT NULL,
    "fanoutResponseId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "accessedAt" TIMESTAMP(3) NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FanoutCitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FanoutCitation_fanoutResponseId_idx" ON "FanoutCitation"("fanoutResponseId");

-- CreateIndex
CREATE INDEX "FanoutCitation_domain_idx" ON "FanoutCitation"("domain");

-- CreateIndex
CREATE INDEX "FanoutCitation_url_idx" ON "FanoutCitation"("url");

-- CreateIndex
CREATE INDEX "FanoutCitation_fanoutResponseId_position_idx" ON "FanoutCitation"("fanoutResponseId", "position");

-- CreateIndex
CREATE INDEX "BlogPost_slug_idx" ON "BlogPost"("slug");

-- CreateIndex
CREATE INDEX "BlogPost_tags_idx" ON "BlogPost"("tags");

-- AddForeignKey
ALTER TABLE "FanoutCitation" ADD CONSTRAINT "FanoutCitation_fanoutResponseId_fkey" FOREIGN KEY ("fanoutResponseId") REFERENCES "FanoutResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
