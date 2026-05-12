-- CreateTable
CREATE TABLE "ProductImage" (
    "id" SERIAL NOT NULL,
    "googleFileId" VARCHAR(255) NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/webp',
    "webpFileId" VARCHAR(255),
    "storagePath" TEXT NOT NULL DEFAULT 'Products',
    "uploadedById" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'product',
    "folder" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "thumbnailUrl" TEXT,
    "fullUrl" TEXT,
    "isGif" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_googleFileId_key" ON "ProductImage"("googleFileId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_webpFileId_key" ON "ProductImage"("webpFileId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_googleFileId_storagePath_key" ON "ProductImage"("googleFileId", "storagePath");

-- CreateIndex
CREATE INDEX "ProductImage_storagePath_deletedAt_idx" ON "ProductImage"("storagePath", "deletedAt");

-- CreateIndex
CREATE INDEX "ProductImage_uploadedById_createdAt_idx" ON "ProductImage"("uploadedById", "createdAt");

-- CreateIndex
CREATE INDEX "ProductImage_folder_idx" ON "ProductImage"("folder");

-- CreateIndex
CREATE INDEX "ProductImage_createdAt_idx" ON "ProductImage"("createdAt");

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
