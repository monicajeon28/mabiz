-- 계약서 템플릿 적용 대상 정의
CREATE TABLE "ContractApplicableEntity" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "templateId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "partnerId" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "ContractApplicableEntity_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ContractTemplate" ("id") ON DELETE CASCADE,
  CONSTRAINT "ContractApplicableEntity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE,
  CONSTRAINT "ContractApplicableEntity_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE SET NULL
);

-- 대리점별 적용된 계약서
CREATE TABLE "PartnerContract" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "htmlContent" TEXT,
  "jsonContent" JSONB,
  "fieldMapping" JSONB NOT NULL DEFAULT '{}',
  "psychologyLenses" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "sections" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'active',
  "appliedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "PartnerContract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE,
  CONSTRAINT "PartnerContract_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE CASCADE,
  CONSTRAINT "PartnerContract_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ContractTemplate" ("id") ON DELETE RESTRICT
);

-- 대리점별 계약서의 섹션
CREATE TABLE "PartnerContractSection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "contractId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "PartnerContractSection_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "PartnerContract" ("id") ON DELETE CASCADE
);

-- 인덱스 생성
CREATE UNIQUE INDEX "ContractApplicableEntity_templateId_entityType_partnerId_key" ON "ContractApplicableEntity"("templateId", "entityType", "partnerId");
CREATE INDEX "ContractApplicableEntity_organizationId_idx" ON "ContractApplicableEntity"("organizationId");
CREATE INDEX "ContractApplicableEntity_templateId_idx" ON "ContractApplicableEntity"("templateId");
CREATE INDEX "ContractApplicableEntity_partnerId_idx" ON "ContractApplicableEntity"("partnerId");

CREATE UNIQUE INDEX "PartnerContract_partnerId_templateId_key" ON "PartnerContract"("partnerId", "templateId");
CREATE INDEX "PartnerContract_organizationId_idx" ON "PartnerContract"("organizationId");
CREATE INDEX "PartnerContract_partnerId_idx" ON "PartnerContract"("partnerId");
CREATE INDEX "PartnerContract_templateId_idx" ON "PartnerContract"("templateId");
CREATE INDEX "PartnerContract_status_idx" ON "PartnerContract"("status");

CREATE INDEX "PartnerContractSection_contractId_idx" ON "PartnerContractSection"("contractId");
