-- AlterTable
ALTER TABLE "GoldMember" ADD COLUMN "productType" TEXT,
ADD COLUMN "maxPaymentCount" INTEGER;

-- CreateIndex
CREATE INDEX "GoldMember_productType_idx" ON "GoldMember"("productType");
