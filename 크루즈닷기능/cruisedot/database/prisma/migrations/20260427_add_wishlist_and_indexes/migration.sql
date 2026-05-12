-- CreateTable Wishlist
CREATE TABLE "Wishlist" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "cruiseProductId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex Wishlist_userId_cruiseProductId_key (UNIQUE constraint)
CREATE UNIQUE INDEX "Wishlist_userId_cruiseProductId_key" ON "Wishlist"("userId", "cruiseProductId");

-- CreateIndex Wishlist_userId_idx
CREATE INDEX "Wishlist_userId_idx" ON "Wishlist"("userId");

-- CreateIndex Wishlist_cruiseProductId_idx
CREATE INDEX "Wishlist_cruiseProductId_idx" ON "Wishlist"("cruiseProductId");

-- CreateIndex Wishlist_createdAt_idx
CREATE INDEX "Wishlist_createdAt_idx" ON "Wishlist"("createdAt");

-- AddForeignKey Wishlist_userId_fkey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey Wishlist_cruiseProductId_fkey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_cruiseProductId_fkey" FOREIGN KEY ("cruiseProductId") REFERENCES "CruiseProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add composite index to CruiseProduct for search/filter optimization
CREATE INDEX "CruiseProduct_saleStatus_basePrice_idx" ON "CruiseProduct"("saleStatus", "basePrice");
