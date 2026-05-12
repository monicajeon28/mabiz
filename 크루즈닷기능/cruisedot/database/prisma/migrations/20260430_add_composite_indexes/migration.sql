-- CreateIndex: saleStatus, isPopular, createdAt DESC
CREATE INDEX "CruiseProduct_saleStatus_isPopular_createdAt_idx" ON "CruiseProduct"("saleStatus", "isPopular", "createdAt" DESC);

-- CreateIndex: basePrice, createdAt DESC
CREATE INDEX "CruiseProduct_basePrice_createdAt_idx" ON "CruiseProduct"("basePrice", "createdAt" DESC);
