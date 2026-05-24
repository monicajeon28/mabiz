-- CreateTable: ContractTemplateAuditLog (계약서 템플릿 감사 로그)
-- 템플릿 생성/수정/삭제/복원/발행/보관 시 자동 기록
-- 참조 무결성: templateId 외래키 + onDelete: Cascade

CREATE TABLE "ContractTemplateAuditLog" (
    "id"                  TEXT NOT NULL,
    "organizationId"      TEXT NOT NULL,
    "templateId"          TEXT NOT NULL,
    "userId"              TEXT,
    "action"              TEXT NOT NULL,
    "previousValues"      JSONB,
    "newValues"           JSONB,
    "changeDescription"   TEXT,
    "reason"              TEXT,
    "status"              TEXT NOT NULL DEFAULT 'SUCCESS',
    "errorMessage"        TEXT,
    "ipAddress"           TEXT,
    "userAgent"           TEXT,
    "createdAt"           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractTemplateAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (조회 성능)
CREATE INDEX "ContractTemplateAuditLog_organizationId_idx" ON "ContractTemplateAuditLog"("organizationId");
CREATE INDEX "ContractTemplateAuditLog_templateId_idx" ON "ContractTemplateAuditLog"("templateId");
CREATE INDEX "ContractTemplateAuditLog_userId_idx" ON "ContractTemplateAuditLog"("userId");
CREATE INDEX "ContractTemplateAuditLog_action_idx" ON "ContractTemplateAuditLog"("action");
CREATE INDEX "ContractTemplateAuditLog_createdAt_idx" ON "ContractTemplateAuditLog"("createdAt");

-- CreateIndex (복합 인덱스: 조직별 템플릿 감사 로그 조회 최적화)
CREATE INDEX "ContractTemplateAuditLog_orgId_templateId_createdAt_idx" ON "ContractTemplateAuditLog"("organizationId", "templateId", "createdAt" DESC);

-- AddForeignKey (Organization)
ALTER TABLE "ContractTemplateAuditLog"
ADD CONSTRAINT "ContractTemplateAuditLog_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (ContractTemplate)
ALTER TABLE "ContractTemplateAuditLog"
ADD CONSTRAINT "ContractTemplateAuditLog_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "ContractTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add relation field to ContractTemplate (auditLogs)
-- Note: This is handled by Prisma schema, no SQL needed

-- Add relation field to Organization (contractTemplateAuditLogs)
-- Note: This is handled by Prisma schema, no SQL needed

-- Comment for documentation
COMMENT ON TABLE "ContractTemplateAuditLog" IS '계약서 템플릿 감사 로그: 모든 변경 이력 추적, 참조 무결성 보증';
COMMENT ON COLUMN "ContractTemplateAuditLog"."action" IS 'CREATE|UPDATE|DELETE|RESTORE|PUBLISH|ARCHIVE';
COMMENT ON COLUMN "ContractTemplateAuditLog"."previousValues" IS '변경 전 값 (마스킹된 민감 정보)';
COMMENT ON COLUMN "ContractTemplateAuditLog"."newValues" IS '변경 후 값 (마스킹된 민감 정보)';
COMMENT ON COLUMN "ContractTemplateAuditLog"."status" IS 'SUCCESS|FAILED (작업 성공 여부)';
