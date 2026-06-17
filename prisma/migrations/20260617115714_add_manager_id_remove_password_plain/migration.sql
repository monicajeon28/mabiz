-- Migration: add managerId to OrganizationMember + remove passwordPlain
-- 2026-06-17

-- [1] managerId 컬럼 추가 (nullable, 기존 데이터 영향 없음)
ALTER TABLE "OrganizationMember"
  ADD COLUMN "managerId" TEXT;

-- [2] self-loop 방지 CHECK constraint
ALTER TABLE "OrganizationMember"
  ADD CONSTRAINT "check_manager_not_self" CHECK ("id" <> "managerId");

-- [3] FK 제약 추가 (onDelete SET NULL)
ALTER TABLE "OrganizationMember"
  ADD CONSTRAINT "OrganizationMember_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "OrganizationMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- [4] managerId 인덱스 추가
CREATE INDEX "OrganizationMember_managerId_idx" ON "OrganizationMember"("managerId");

-- [5] passwordPlain 컬럼 제거 (OWASP A02: 평문 비밀번호 DB 저장 금지)
ALTER TABLE "OrganizationMember"
  DROP COLUMN IF EXISTS "passwordPlain";
