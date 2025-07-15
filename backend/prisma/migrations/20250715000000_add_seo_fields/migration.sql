-- AddSEOFields
ALTER TABLE "BlogPost" ADD COLUMN "metaTitle" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN "metaDescription" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN "canonicalUrl" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN "openGraphImage" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN "twitterCard" TEXT DEFAULT 'summary_large_image';
ALTER TABLE "BlogPost" ADD COLUMN "tags" TEXT[];
ALTER TABLE "BlogPost" ADD COLUMN "estimatedReadTime" INTEGER;