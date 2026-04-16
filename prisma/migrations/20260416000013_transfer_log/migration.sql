-- freeSalesId → affiliateCode 이름 변경 + ContactTransferLog 추가 (WO-28)

-- 1. 컬럼 이름 변경
ALTER TABLE "Contact" RENAME COLUMN "freeSalesId" TO "affiliateCode";
CREATE INDEX IF NOT EXISTS "Contact_affiliateCode_idx" ON "Contact"("affiliateCode");

-- 2. ContactTransferLog 테이블
CREATE TABLE "ContactTransferLog" (
  "id"            TEXT        NOT NULL,
  "contactId"     TEXT        NOT NULL,
  "fromOrgId"     TEXT        NOT NULL,
  "toOrgId"       TEXT,
  "toUserId"      TEXT,
  "newContactId"  TEXT,
  "transferType"  TEXT        NOT NULL,
  "transferredBy" TEXT        NOT NULL,
  "note"          TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ContactTransferLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContactTransferLog_fromOrgId_fkey"
    FOREIGN KEY ("fromOrgId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "ContactTransferLog_toOrgId_fkey"
    FOREIGN KEY ("toOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL
);
CREATE INDEX "ContactTransferLog_contactId_idx"     ON "ContactTransferLog"("contactId");
CREATE INDEX "ContactTransferLog_fromOrgId_idx"     ON "ContactTransferLog"("fromOrgId");
CREATE INDEX "ContactTransferLog_toOrgId_idx"       ON "ContactTransferLog"("toOrgId");
CREATE INDEX "ContactTransferLog_transferredBy_idx" ON "ContactTransferLog"("transferredBy");
