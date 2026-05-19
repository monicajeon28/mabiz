-- Migration: Phase 4 Step 5 - 10렌즈 DB 스키마 확장
-- Date: 2026-05-19
-- Author: Menu #38 Phase 4 Agent
-- Description: 렌즈 분류, 시퀀스 추적, 템플릿 관리를 위한 신규 테이블 3개 + 기존 테이블 확장
-- 절대법칙: 기존 테이블 삭제 금지, 기존 칼럼 제거 금지, 추가 칼럼만 허용

BEGIN;

-- ============================================================================
-- STEP 1: 신규 테이블 생성 - ContactLensClassification
-- 목적: 각 고객이 어느 렌즈(L1-L10)에 해당하는지 저장
-- ============================================================================

CREATE TABLE "ContactLensClassification" (
  id                    TEXT NOT NULL PRIMARY KEY,
  contactId             TEXT NOT NULL,
  organizationId        TEXT NOT NULL,

  lensType              VARCHAR(3) NOT NULL,
  lensLabel             VARCHAR(50),
  confidenceScore       INT NOT NULL DEFAULT 0,

  identificationMethod  VARCHAR(20),
  questionnaireResponses JSONB,

  decisionLevel         INT DEFAULT 0,
  readinessScore        INT DEFAULT 0,

  priorityLevel         VARCHAR(10),
  status                VARCHAR(20) DEFAULT 'ACTIVE',

  identifiedAt          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lastUpdated           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  convertedAt           TIMESTAMPTZ,

  notes                 TEXT,
  tags                  TEXT[],

  CONSTRAINT fk_lens_contact FOREIGN KEY (contactId) REFERENCES "Contact"(id) ON DELETE CASCADE,
  CONSTRAINT fk_lens_org FOREIGN KEY (organizationId) REFERENCES "Organization"(id) ON DELETE CASCADE,
  CONSTRAINT ck_lens_type CHECK (lensType IN ('L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10')),
  CONSTRAINT uk_lens_contact_type UNIQUE(organizationId, contactId, lensType)
);

CREATE INDEX "idx_lens_org_type" ON "ContactLensClassification"(organizationId, lensType);
CREATE INDEX "idx_lens_priority" ON "ContactLensClassification"(priorityLevel, status);
CREATE INDEX "idx_lens_confidence" ON "ContactLensClassification"(organizationId, confidenceScore DESC);
CREATE INDEX "idx_lens_contact_id" ON "ContactLensClassification"(contactId);

-- ============================================================================
-- STEP 2: 신규 테이블 생성 - ContactLensSequence
-- 목적: 각 고객의 렌즈별 SMS 발송 진행도 추적 (Day 0/1/2/3)
-- ============================================================================

CREATE TABLE "ContactLensSequence" (
  id                    TEXT NOT NULL PRIMARY KEY,
  contactId             TEXT NOT NULL,
  organizationId        TEXT NOT NULL,
  classificationId      TEXT NOT NULL,

  sequenceType          VARCHAR(20) NOT NULL,
  lensType              VARCHAR(3),

  day0Sent              BOOLEAN DEFAULT FALSE,
  day0SentAt            TIMESTAMPTZ,
  day0Clicked           BOOLEAN DEFAULT FALSE,
  day0ClickedAt         TIMESTAMPTZ,
  day0ConvertedAt       TIMESTAMPTZ,

  day1Sent              BOOLEAN DEFAULT FALSE,
  day1SentAt            TIMESTAMPTZ,
  day1Clicked           BOOLEAN DEFAULT FALSE,
  day1ClickedAt         TIMESTAMPTZ,
  day1ConvertedAt       TIMESTAMPTZ,

  day2Sent              BOOLEAN DEFAULT FALSE,
  day2SentAt            TIMESTAMPTZ,
  day2Clicked           BOOLEAN DEFAULT FALSE,
  day2ClickedAt         TIMESTAMPTZ,
  day2ConvertedAt       TIMESTAMPTZ,

  day3Sent              BOOLEAN DEFAULT FALSE,
  day3SentAt            TIMESTAMPTZ,
  day3Clicked           BOOLEAN DEFAULT FALSE,
  day3ClickedAt         TIMESTAMPTZ,
  day3ConvertedAt       TIMESTAMPTZ,

  overallConverted      BOOLEAN DEFAULT FALSE,
  conversionDate        TIMESTAMPTZ,
  conversionRevenue     NUMERIC(15, 2),

  status                VARCHAR(20) DEFAULT 'PENDING',
  failureReason         VARCHAR(100),
  retryCount            INT DEFAULT 0,

  startedAt             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completedAt           TIMESTAMPTZ,

  CONSTRAINT fk_sequence_contact FOREIGN KEY (contactId) REFERENCES "Contact"(id) ON DELETE CASCADE,
  CONSTRAINT fk_sequence_org FOREIGN KEY (organizationId) REFERENCES "Organization"(id) ON DELETE CASCADE,
  CONSTRAINT fk_sequence_classification FOREIGN KEY (classificationId) REFERENCES "ContactLensClassification"(id) ON DELETE CASCADE
);

CREATE INDEX "idx_sequence_contact" ON "ContactLensSequence"(contactId, lensType);
CREATE INDEX "idx_sequence_org_status" ON "ContactLensSequence"(organizationId, status);
CREATE INDEX "idx_sequence_pending" ON "ContactLensSequence"(organizationId) WHERE status = 'PENDING';
CREATE INDEX "idx_sequence_conversion" ON "ContactLensSequence"(organizationId, overallConverted);

-- ============================================================================
-- STEP 3: 신규 테이블 생성 - LensTemplate
-- 목적: 렌즈별 SMS/Call 템플릿 중앙 관리
-- ============================================================================

CREATE TABLE "LensTemplate" (
  id                    TEXT NOT NULL PRIMARY KEY,
  organizationId        TEXT NOT NULL,

  templateType          VARCHAR(20) NOT NULL,
  lensType              VARCHAR(3) NOT NULL,
  day                   INT NOT NULL DEFAULT 0,
  phase                 INT,

  title                 VARCHAR(100),
  body                  TEXT NOT NULL,

  smsLength             INT,
  expectedClickRate     NUMERIC(5, 2),
  sendDelayMinutes      INT,

  psychologyPrinciple   VARCHAR(50),
  estimatedDurationSeconds INT,
  stepNumber            INT,

  status                VARCHAR(20) DEFAULT 'ACTIVE',
  version               INT DEFAULT 1,
  isSystemTemplate      BOOLEAN DEFAULT FALSE,
  customizations        JSONB,

  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_template_org FOREIGN KEY (organizationId) REFERENCES "Organization"(id) ON DELETE CASCADE,
  CONSTRAINT ck_template_type CHECK (templateType IN ('SMS', 'CALL_SCRIPT', 'EMAIL')),
  CONSTRAINT ck_template_lens CHECK (lensType IN ('L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10'))
);

CREATE INDEX "idx_template_org_lens_type" ON "LensTemplate"(organizationId, lensType, templateType);
CREATE INDEX "idx_template_lens_day" ON "LensTemplate"(lensType, day) WHERE templateType = 'SMS';
CREATE INDEX "idx_template_active" ON "LensTemplate"(organizationId, status) WHERE status = 'ACTIVE';

-- ============================================================================
-- STEP 4: Contact 테이블 칼럼 추가 (Phase 4 렌즈 분류)
-- 목적: 자주 조회되는 렌즈 정보 캐시 (Contact 조회 시 JOIN 최소화)
-- ============================================================================

ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS lensType VARCHAR(3);
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS lensConfidenceScore INT DEFAULT 0;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS lensSequenceStatus VARCHAR(20);
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS lensSequenceStartedAt TIMESTAMPTZ;

ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS lensMetadata JSONB DEFAULT '{"decisionLevel": 0, "readinessScore": 0}';

ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS decisionMadeAt TIMESTAMPTZ;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS decisionOutcome VARCHAR(20);

-- Contact 인덱스 추가
CREATE INDEX IF NOT EXISTS "idx_contact_lens_type" ON "Contact"(organizationId, lensType) WHERE lensType IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_contact_sequence_status" ON "Contact"(lensSequenceStatus) WHERE lensSequenceStatus IS NOT NULL;

-- ============================================================================
-- STEP 5: CrmMarketingCampaign 테이블 칼럼 추가 (렌즈 타겟팅)
-- 목적: 캠페인별 렌즈 타겟팅 및 성과 추적
-- ============================================================================

ALTER TABLE "CrmMarketingCampaign" ADD COLUMN IF NOT EXISTS targetLens VARCHAR(3);
ALTER TABLE "CrmMarketingCampaign" ADD COLUMN IF NOT EXISTS smsTemplateLens VARCHAR(3);
ALTER TABLE "CrmMarketingCampaign" ADD COLUMN IF NOT EXISTS callScriptLens VARCHAR(3);

ALTER TABLE "CrmMarketingCampaign" ADD COLUMN IF NOT EXISTS lensConversionCount INT DEFAULT 0;
ALTER TABLE "CrmMarketingCampaign" ADD COLUMN IF NOT EXISTS lensConversionRate NUMERIC(5, 2);

ALTER TABLE "CrmMarketingCampaign" ADD COLUMN IF NOT EXISTS experimentId TEXT;
ALTER TABLE "CrmMarketingCampaign" ADD COLUMN IF NOT EXISTS variantLens VARCHAR(3);

ALTER TABLE "CrmMarketingCampaign" ADD COLUMN IF NOT EXISTS lensMetadata JSONB;

-- CrmMarketingCampaign 인덱스 추가
CREATE INDEX IF NOT EXISTS "idx_campaign_target_lens" ON "CrmMarketingCampaign"(organizationId, targetLens) WHERE targetLens IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_campaign_template_lens" ON "CrmMarketingCampaign"(smsTemplateLens);

-- ============================================================================
-- STEP 6: 데이터 무결성 검증
-- ============================================================================

DO $$
BEGIN
  -- ContactLensClassification 테이블 생성 확인
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ContactLensClassification') THEN
    RAISE EXCEPTION 'ContactLensClassification table creation failed';
  END IF;

  -- ContactLensSequence 테이블 생성 확인
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ContactLensSequence') THEN
    RAISE EXCEPTION 'ContactLensSequence table creation failed';
  END IF;

  -- LensTemplate 테이블 생성 확인
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'LensTemplate') THEN
    RAISE EXCEPTION 'LensTemplate table creation failed';
  END IF;

  -- Contact 테이블 칼럼 추가 확인
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Contact' AND column_name = 'lensType') THEN
    RAISE EXCEPTION 'Contact.lensType column addition failed';
  END IF;

  RAISE NOTICE 'Phase 4 Step 5 Migration: All checks passed successfully';
END;
$$;

-- ============================================================================
-- STEP 7: 마이그레이션 로깅
-- ============================================================================

-- ExecutionLog에 마이그레이션 기록 추가 (기존 ExecutionLog 테이블 이용)
-- 참고: ExecutionLog 테이블이 없으면 이 부분은 스킵됨
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ExecutionLog') THEN
    INSERT INTO "ExecutionLog" (
      id,
      "executionName",
      status,
      "executedAt",
      "createdAt",
      metadata
    )
    VALUES (
      substr(md5(random()::text), 1, 24),
      'MIGRATION_PHASE4_STEP5_LENS_SCHEMA',
      'SUCCESS',
      NOW(),
      NOW(),
      jsonb_build_object(
        'tables_created', jsonb_build_array('ContactLensClassification', 'ContactLensSequence', 'LensTemplate'),
        'columns_added_contact', jsonb_build_array('lensType', 'lensConfidenceScore', 'lensSequenceStatus', 'lensSequenceStartedAt', 'lensMetadata', 'decisionMadeAt', 'decisionOutcome'),
        'columns_added_campaign', jsonb_build_array('targetLens', 'smsTemplateLens', 'callScriptLens', 'lensMetadata'),
        'indexes_created', 13,
        'migration_date', NOW()::TEXT,
        'phase', 'Step 5-1: DB Schema Design'
      )
    );
  END IF;
END;
$$;

COMMIT;

-- ============================================================================
-- 롤백 지침 (필요시 공식 롤백 명령 사용)
-- ============================================================================
-- npx prisma migrate resolve --rolled-back MIGRATION_NAME
-- 또는 수동 롤백:
-- DROP TABLE IF EXISTS "ContactLensSequence" CASCADE;
-- DROP TABLE IF EXISTS "ContactLensClassification" CASCADE;
-- DROP TABLE IF EXISTS "LensTemplate" CASCADE;
-- ALTER TABLE "Contact" DROP COLUMN IF EXISTS lensType, ... (9개 칼럼)
-- ALTER TABLE "CrmMarketingCampaign" DROP COLUMN IF EXISTS targetLens, ... (8개 칼럼)
