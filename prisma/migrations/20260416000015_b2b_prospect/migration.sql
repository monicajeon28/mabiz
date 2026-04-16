-- B2BProspect: 330만/540만/750만 패키지 잠재고객 파이프라인 (WO-28C)
CREATE TABLE "B2BProspect" (
  "id"              TEXT        NOT NULL,
  "organizationId"  TEXT        NOT NULL,
  "name"            TEXT        NOT NULL,
  "phone"           TEXT        NOT NULL,
  "email"           TEXT,
  "companyName"     TEXT,
  "position"        TEXT,
  "groupSize"       INTEGER,
  "packageInterest" TEXT,
  "budget"          TEXT,
  "preferredDate"   TEXT,
  "destination"     TEXT,
  "status"          TEXT        NOT NULL DEFAULT 'NEW',
  "notes"           TEXT,
  "assignedUserId"  TEXT,
  "source"          TEXT,
  "affiliateCode"   TEXT,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "B2BProspect_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "B2BProspect_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);
CREATE INDEX "B2BProspect_orgId_status_idx"    ON "B2BProspect"("organizationId", "status");
CREATE INDEX "B2BProspect_assignedUserId_idx"  ON "B2BProspect"("assignedUserId");
CREATE INDEX "B2BProspect_affiliateCode_idx"   ON "B2BProspect"("affiliateCode");
