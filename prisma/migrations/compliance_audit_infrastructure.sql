-- ============================================================================
-- 마비즈 CRM Compliance Monitoring Infrastructure
-- 2026-05-27 Created by Compliance Monitor Agent
-- ============================================================================

-- 1️⃣ 중앙 감시 로그 테이블 (Audit Trail - 모든 PII 접근 기록)
CREATE TABLE IF NOT EXISTS "AuditLog" (
  id                BIGSERIAL PRIMARY KEY,

  -- 식별정보
  organizationId    VARCHAR(255),
  userId            VARCHAR(255),
  sessionId         VARCHAR(255),
  ipAddress         VARCHAR(45),  -- IPv4/IPv6
  userAgent         TEXT,

  -- 액션 정보
  action            VARCHAR(50) NOT NULL,  -- "READ", "WRITE", "DELETE", "EXPORT", "LOGIN", "LOGOUT"
  resourceType      VARCHAR(100) NOT NULL, -- "Contact", "OrganizationMember", "Document", "Affiliate"
  resourceId        VARCHAR(255),

  -- PII 필드 추적
  piiFieldsAccessed TEXT[],  -- ARRAY of field names: ["phone", "email", "name"]
  piiValuesModified JSONB,   -- Before/after values (masked for storage)

  -- 결과
  status            VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',  -- SUCCESS, FAILED, DENIED
  errorMessage      TEXT,

  -- 목적/근거
  purpose           VARCHAR(255),  -- "Business", "Compliance", "Support", "Investigation"
  reasonDescription TEXT,

  -- 타이밍
  createdAt         TIMESTAMP NOT NULL DEFAULT NOW(),
  durationMs        INTEGER,  -- 작업 소요시간

  -- 인덱싱 전략
  CONSTRAINT audit_log_pkey PRIMARY KEY (id),
  INDEX idx_audit_org_time ON "AuditLog" (organizationId, createdAt DESC),
  INDEX idx_audit_user_time ON "AuditLog" (userId, createdAt DESC),
  INDEX idx_audit_action ON "AuditLog" (action, createdAt DESC),
  INDEX idx_audit_pii_access ON "AuditLog" (piiFieldsAccessed) WHERE piiFieldsAccessed IS NOT NULL,
  INDEX idx_audit_status ON "AuditLog" (status, createdAt DESC),
  INDEX idx_audit_resource ON "AuditLog" (resourceType, resourceId),

  -- 파티셔닝 (월별 자동 분할 - 성능 최적화)
  PARTITION BY RANGE (DATE_TRUNC('month', createdAt))
) PARTITION BY RANGE (DATE_TRUNC('month', createdAt));

-- 2️⃣ 감시 규칙 엔진 (Monitoring Rules)
CREATE TABLE IF NOT EXISTS "ComplianceRule" (
  id                SERIAL PRIMARY KEY,
  organizationId    VARCHAR(255) NOT NULL,

  -- 규칙 정의
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  ruleType          VARCHAR(50) NOT NULL,  -- "ANOMALY", "THRESHOLD", "PATTERN", "REGEX"

  -- 감지 조건
  condition         JSONB NOT NULL,  -- { "field": "loginCount", "operator": ">", "threshold": 10 }
  timeWindow        INTEGER,  -- 시간 단위 (예: 1시간, 1일)

  -- 조치
  severity          VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',  -- LOW, MEDIUM, HIGH, CRITICAL
  alertAction       VARCHAR(50),  -- "LOG", "NOTIFY", "BLOCK", "REVIEW"
  alertChannels     TEXT[],  -- ARRAY of channels: ["SLACK", "EMAIL", "SMS"]

  -- 상태
  isActive          BOOLEAN DEFAULT TRUE,
  createdAt         TIMESTAMP DEFAULT NOW(),
  updatedAt         TIMESTAMP DEFAULT NOW(),

  CONSTRAINT compliance_rule_pkey PRIMARY KEY (id),
  INDEX idx_rule_org ON "ComplianceRule" (organizationId, isActive)
);

-- 3️⃣ 이상 탐지 기록 (Anomaly Detection Log)
CREATE TABLE IF NOT EXISTS "AnomalyDetection" (
  id                SERIAL PRIMARY KEY,

  -- 대상
  organizationId    VARCHAR(255) NOT NULL,
  userId            VARCHAR(255) NOT NULL,

  -- 이상 탐지
  anomalyType       VARCHAR(50) NOT NULL,  -- "UNUSUAL_IP", "UNUSUAL_TIME", "BULK_DOWNLOAD", "PRIVILEGE_ESCALATION", "FAILED_LOGINS"
  severity          VARCHAR(20) NOT NULL,  -- LOW, MEDIUM, HIGH, CRITICAL

  -- 상세정보
  details           JSONB NOT NULL,
  riskScore         SMALLINT DEFAULT 0,  -- 0-100 위험도

  -- 상태
  status            VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, INVESTIGATING, RESOLVED, FALSE_POSITIVE
  investigatedBy    VARCHAR(255),
  investigatedAt    TIMESTAMP,
  resolutionNote    TEXT,

  createdAt         TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt         TIMESTAMP DEFAULT NOW(),

  CONSTRAINT anomaly_pkey PRIMARY KEY (id),
  INDEX idx_anomaly_org_time ON "AnomalyDetection" (organizationId, createdAt DESC),
  INDEX idx_anomaly_severity ON "AnomalyDetection" (severity, status),
  INDEX idx_anomaly_user ON "AnomalyDetection" (userId, createdAt DESC)
);

-- 4️⃣ PII 접근 권한 RBAC (Role-Based Access Control for PII)
CREATE TABLE IF NOT EXISTS "PiiAccessPolicy" (
  id                SERIAL PRIMARY KEY,
  organizationId    VARCHAR(255) NOT NULL,

  -- 역할 기반
  roleName          VARCHAR(50) NOT NULL,  -- "GLOBAL_ADMIN", "OWNER", "AGENT", "ANALYST"

  -- PII 필드 접근 권한
  allowedPiiFields  TEXT[],  -- ARRAY: ["phone", "email"] (read)
  modifiablePiiFields TEXT[],  -- ARRAY: ["name"] (write)

  -- 데이터 범위
  dataScope         VARCHAR(50) NOT NULL DEFAULT 'ORG',  -- ORG (자신 조직), ALL (전체)

  -- 조건부 접근
  requiresApproval  BOOLEAN DEFAULT FALSE,
  maxBulkExportRows INTEGER DEFAULT 100,
  maxQueryResults   INTEGER DEFAULT 1000,

  createdAt         TIMESTAMP DEFAULT NOW(),
  updatedAt         TIMESTAMP DEFAULT NOW(),

  CONSTRAINT pii_policy_pkey PRIMARY KEY (id),
  CONSTRAINT pii_policy_unique UNIQUE (organizationId, roleName),
  INDEX idx_pii_policy_org ON "PiiAccessPolicy" (organizationId)
);

-- 5️⃣ 규정 준수 체크리스트 (Compliance Checklist)
CREATE TABLE IF NOT EXISTS "ComplianceChecklist" (
  id                SERIAL PRIMARY KEY,
  organizationId    VARCHAR(255) NOT NULL,

  -- 규정 종류
  regulationType    VARCHAR(50) NOT NULL,  -- "GDPR", "CCPA", "HIPAA", "INTERNAL"

  -- 항목
  items             JSONB NOT NULL,  -- [{ "id": "gdpr_1", "name": "Data Request Handler", "completed": true, "completedAt": "2026-05-27" }]

  -- 상태
  completionRate    SMALLINT DEFAULT 0,  -- 0-100%
  lastVerifiedAt    TIMESTAMP,
  nextAuditDate     DATE,

  createdAt         TIMESTAMP DEFAULT NOW(),
  updatedAt         TIMESTAMP DEFAULT NOW(),

  CONSTRAINT compliance_checklist_pkey PRIMARY KEY (id),
  INDEX idx_checklist_org ON "ComplianceChecklist" (organizationId, regulationType)
);

-- 6️⃣ 데이터 백업 증명 (Backup Audit Trail)
CREATE TABLE IF NOT EXISTS "BackupAuditTrail" (
  id                SERIAL PRIMARY KEY,
  organizationId    VARCHAR(255) NOT NULL,

  -- 백업 정보
  backupId          VARCHAR(255) NOT NULL UNIQUE,
  backupType        VARCHAR(50) NOT NULL,  -- "DAILY", "WEEKLY", "MONTHLY", "ON_DEMAND"

  -- 데이터
  totalRecords      BIGINT,
  backupSizeBytes   BIGINT,
  encryptionStatus  VARCHAR(20) DEFAULT 'ENCRYPTED',  -- ENCRYPTED, NOT_ENCRYPTED

  -- 검증
  verificationHash  VARCHAR(255),
  verifiedAt        TIMESTAMP,

  -- 보관
  location          VARCHAR(255),  -- "AWS_S3", "AZURE_BLOB", "LOCAL"
  retentionDays     INTEGER DEFAULT 2555,  -- 5년 기본값
  expiresAt         DATE,

  createdAt         TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT backup_audit_pkey PRIMARY KEY (id),
  INDEX idx_backup_org ON "BackupAuditTrail" (organizationId, createdAt DESC),
  INDEX idx_backup_expires ON "BackupAuditTrail" (expiresAt)
);

-- 7️⃣ 데이터 요청 기록 (Data Access Request Log - GDPR/CCPA)
CREATE TABLE IF NOT EXISTS "DataAccessRequest" (
  id                SERIAL PRIMARY KEY,
  organizationId    VARCHAR(255) NOT NULL,

  -- 요청자
  requestedBy       VARCHAR(255),
  requestType       VARCHAR(50) NOT NULL,  -- "EXPORT", "DELETE", "RECTIFY", "RESTRICT"

  -- 대상 데이터
  dataSubjectId     VARCHAR(255),
  relatedContactIds TEXT[],

  -- 상태
  status            VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING, APPROVED, DENIED, COMPLETED
  approvedBy        VARCHAR(255),
  completedAt       TIMESTAMP,

  -- 증명
  verificationToken VARCHAR(255),
  expiresAt         TIMESTAMP,

  createdAt         TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT data_request_pkey PRIMARY KEY (id),
  INDEX idx_data_request_org ON "DataAccessRequest" (organizationId, createdAt DESC),
  INDEX idx_data_request_status ON "DataAccessRequest" (status, expiresAt)
);

-- ============================================================================
-- 초기 PII 접근 정책 설정 (기본값)
-- ============================================================================

INSERT INTO "PiiAccessPolicy" (organizationId, roleName, allowedPiiFields, modifiablePiiFields, dataScope, requiresApproval)
VALUES
  ('*', 'GLOBAL_ADMIN', ARRAY['phone', 'email', 'name', 'addressId', 'bankAccount', 'idNumber'], ARRAY['phone', 'email', 'name', 'addressId'], 'ALL', false),
  ('*', 'OWNER', ARRAY['phone', 'email', 'name'], ARRAY['phone', 'email', 'name'], 'ORG', false),
  ('*', 'AGENT', ARRAY['phone', 'email', 'name'], ARRAY['phone', 'email', 'name'], 'ORG', false),
  ('*', 'ANALYST', ARRAY['phone', 'email'], ARRAY[], 'ORG', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 초기 규정 준수 규칙 설정
-- ============================================================================

INSERT INTO "ComplianceRule" (organizationId, name, ruleType, condition, timeWindow, severity, alertAction, alertChannels, isActive)
VALUES
  -- 이상 로그인 감지
  ('*', 'Unusual Login Activity', 'ANOMALY', '{"metric": "failedLoginAttempts", "operator": ">", "threshold": 5}', 60, 'HIGH', 'NOTIFY', ARRAY['SLACK', 'EMAIL'], true),

  -- 대량 데이터 다운로드 감지
  ('*', 'Bulk Data Export', 'THRESHOLD', '{"metric": "exportedRows", "operator": ">", "threshold": 10000}', 60, 'CRITICAL', 'BLOCK', ARRAY['SLACK', 'EMAIL'], true),

  -- 야간 접근 패턴
  ('*', 'Unusual Access Time', 'PATTERN', '{"hour": [0, 5], "action": "READ"}', 1440, 'MEDIUM', 'LOG', ARRAY['SLACK'], true),

  -- PII 대량 접근
  ('*', 'PII Mass Access', 'THRESHOLD', '{"metric": "piiFieldsAccessed", "operator": ">", "threshold": 100}', 60, 'HIGH', 'REVIEW', ARRAY['SLACK', 'EMAIL'], true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 초기 규정 준수 체크리스트 설정 (GDPR)
-- ============================================================================

INSERT INTO "ComplianceChecklist" (organizationId, regulationType, items)
VALUES
  ('*', 'GDPR', '{
    "items": [
      {"id": "gdpr_1", "name": "Data Request Handler (데이터 요청 30일 이내 처리)", "completed": false},
      {"id": "gdpr_2", "name": "Right to Delete (삭제권 구현)", "completed": false},
      {"id": "gdpr_3", "name": "Consent Management (동의 기록)", "completed": false},
      {"id": "gdpr_4", "name": "Data Processing Agreement (DPA 체결)", "completed": false},
      {"id": "gdpr_5", "name": "Privacy Impact Assessment (DPIA)", "completed": false},
      {"id": "gdpr_6", "name": "Breach Notification (72시간 이내 통보)", "completed": false},
      {"id": "gdpr_7", "name": "Data Retention Policy (보관 기한 명시)", "completed": false},
      {"id": "gdpr_8", "name": "Audit Trail (감사 로그 유지)", "completed": true}
    ]
  }')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 인덱스 추가 (성능 최적화)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_audit_log_org_time ON "AuditLog" (organizationId, createdAt DESC)
  WHERE status != 'SUCCESS';

CREATE INDEX IF NOT EXISTS idx_audit_log_pii ON "AuditLog" (piiFieldsAccessed)
  USING GIN
  WHERE piiFieldsAccessed IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_anomaly_risk_score ON "AnomalyDetection" (riskScore DESC)
  WHERE status = 'PENDING';

-- ============================================================================
-- 보관 정책 (5년 이상 보관 후 자동 아카이빙)
-- ============================================================================
-- NOTE: 실제 구현은 시스템 크론 작업으로 처리
-- - 월별 파티셔닝으로 오래된 파티션 자동 분리
-- - 5년(60개월) 이후 데이터는 별도 보관소로 이동
-- - 3개월마다 자동 압축 (BRIN 인덱스 활용)

COMMENT ON TABLE "AuditLog" IS '모든 PII 접근, 수정, 삭제 작업의 중앙 감시 로그. 규정 준수 증거.';
COMMENT ON TABLE "ComplianceRule" IS '실시간 이상 탐지 규칙. 자동 경고 및 조치 트리거.';
COMMENT ON TABLE "AnomalyDetection" IS '탐지된 이상 활동. 위험도 0-100 점수.';
COMMENT ON TABLE "PiiAccessPolicy" IS 'RBAC 기반 PII 필드 접근 권한 관리.';
COMMENT ON TABLE "ComplianceChecklist" IS 'GDPR/CCPA 규정 준수 체크리스트.';
COMMENT ON TABLE "BackupAuditTrail" IS '일일/주간/월간 백업 기록 및 검증.';
COMMENT ON TABLE "DataAccessRequest" IS 'GDPR 데이터 요청 (내보내기/삭제/수정) 추적.';
