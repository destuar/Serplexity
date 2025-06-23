-- CreateTable
CREATE TABLE "VisibilityQuestion" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisibilityQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisibilityQuestion_productId_idx" ON "VisibilityQuestion"("productId");

-- AddForeignKey
ALTER TABLE "VisibilityQuestion" ADD CONSTRAINT "VisibilityQuestion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
