-- AddAmountToAffiliateContract
ALTER TABLE "AffiliateContract" ADD COLUMN "amount" INTEGER NOT NULL DEFAULT 3300000;

-- CreateIndex
CREATE INDEX "AffiliateContract_amount_status_idx" ON "AffiliateContract"("amount", "status");
