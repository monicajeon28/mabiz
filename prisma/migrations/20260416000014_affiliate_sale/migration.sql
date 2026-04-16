-- AffiliateSale: 어필리에이트 판매 이력 (WO-28B)
CREATE TABLE "AffiliateSale" (
  "id"              TEXT        NOT NULL,
  "organizationId"  TEXT        NOT NULL,
  "affiliateCode"   TEXT        NOT NULL,
  "affiliateUserId" TEXT,
  "productName"     TEXT        NOT NULL,
  "saleAmount"      INTEGER     NOT NULL,
  "commissionRate"  INTEGER     NOT NULL DEFAULT 0,
  "commissionAmount" INTEGER    NOT NULL DEFAULT 0,
  "status"          TEXT        NOT NULL DEFAULT 'PENDING',
  "travelCompletedAt" TIMESTAMPTZ,
  "paidAt"          TIMESTAMPTZ,
  "customerPhone"   TEXT,
  "orderId"         TEXT,
  "sourceWebhook"   TEXT,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "AffiliateSale_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AffiliateSale_orderId_key" UNIQUE ("orderId"),
  CONSTRAINT "AffiliateSale_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);
CREATE INDEX "AffiliateSale_organizationId_idx"  ON "AffiliateSale"("organizationId");
CREATE INDEX "AffiliateSale_affiliateCode_idx"   ON "AffiliateSale"("affiliateCode");
CREATE INDEX "AffiliateSale_affiliateUserId_idx" ON "AffiliateSale"("affiliateUserId");
CREATE INDEX "AffiliateSale_status_idx"          ON "AffiliateSale"("status");
