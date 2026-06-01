# Phase 3-B: PostgreSQL RLS 정책 + Audit Logger 구현 가이드

## 📋 개요

이 문서는 CommissionLedger 데이터의 보안을 강화하기 위해 구현된 PostgreSQL Row Level Security (RLS) 정책과 감시 로그(Audit Logger) 시스템을 설명합니다.

**핵심 기능:**
- ✅ PostgreSQL RLS 정책 (테넌트 격리)
- ✅ Application-Layer Authorization Checks
- ✅ 포괄적인 감시 로깅 (AuditLog 테이블)
- ✅ 보안 이벤트 모니터링 (SecurityEvent 테이블)
- ✅ 실시간 보안팀 알림 (구현 예정)
- ✅ 감시 대시보드 UI

---

## 🔐 구현된 보안 정책

### 1. PostgreSQL RLS 정책 (prisma/migrations/rls_commission_ledger_policies.sql)

#### SELECT 정책
```sql
-- GLOBAL_ADMIN: 모든 행 조회 가능
-- OWNER: 자신의 organizationId에 속한 행만 조회
-- AGENT/FREE_SALES: 자신의 organizationId + profileId에 속한 행만 조회
```

#### INSERT 정책
```sql
-- GLOBAL_ADMIN만 新규 정산 레코드 생성 가능
-- organizationId 검증: Organization 테이블 존재성 확인
```

#### UPDATE 정책
```sql
-- GLOBAL_ADMIN만 정산 레코드 수정 가능
-- organizationId 변경 불가능 (테넌트 격리 유지)
```

#### DELETE 정책
```sql
-- 절대 DELETE 금지 (감사 추적 유지)
-- 모든 DELETE 시도는 CRITICAL 보안 이벤트 생성
```

---

## 🛡️ Application-Layer Authorization

### Audit Logger (`src/lib/audit-logger.ts`)

핵심 함수:

#### 1. `checkCommissionLedgerSelectPermission(ctx, organizationId, profileId?)`
SELECT 권한 검증:
- **UNAUTHENTICATED**: null context → DENIED
- **GLOBAL_ADMIN**: 모든 organizationId → ALLOWED
- **OWNER**: 자신의 organizationId만 → ALLOWED
- **AGENT**: 자신의 organizationId + profileId만 → ALLOWED
- **위반 시**: SecurityEvent 생성 (PERMISSION_DENIED, HIGH/MEDIUM 심각도)

#### 2. `checkCommissionLedgerModifyPermission(ctx, organizationId)`
INSERT/UPDATE 권한 검증:
- **GLOBAL_ADMIN만 가능**
- 나머지 역할: INSUFFICIENT_PRIVILEGE → DENIED
- **위반 시**: SecurityEvent 생성 (PERMISSION_DENIED, CRITICAL)

#### 3. `checkCommissionLedgerDeletePermission(ctx, organizationId)`
DELETE 권한 검증:
- **절대 불가능** (모든 사용자)
- **항상 DENIED**, CRITICAL 보안 이벤트 생성

#### 4. `logAuditEntry(entry)`
접근 로그 기록:
```typescript
interface AuditLogEntry {
  action: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  recordId?: string | number;
  userId: string;
  organizationId: string | null;
  status: 'ALLOWED' | 'DENIED';
  reason?: string;
  details?: Record<string, any>;
  timestamp: Date;
}
```

#### 5. `logSecurityEvent(event)`
보안 이벤트 기록:
```typescript
interface SecurityEvent {
  type: 'UNAUTHORIZED_ACCESS' | 'PERMISSION_DENIED' | 'SUSPICIOUS_ACTIVITY' | 'PRIVILEGE_ESCALATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId: string;
  organizationId: string | null;
  description: string;
  details: Record<string, any>;
  timestamp: Date;
}
```

#### 6. `notifySecurityTeam(event)`
실시간 보안팀 알림 (CRITICAL/HIGH 심각도만):
- 콘솔 로깅 (즉시)
- Slack 웹훅 (구현 예정)
- 이메일 발송 (구현 예정)
- SMS 경고 (구현 예정)

---

## 📊 데이터베이스 테이블

### AuditLog 테이블
```sql
CREATE TABLE "AuditLog" (
  id SERIAL PRIMARY KEY,
  action VARCHAR(20) NOT NULL,        -- SELECT, INSERT, UPDATE, DELETE
  table VARCHAR(255) NOT NULL,        -- 접근 대상 테이블
  recordId VARCHAR(255),              -- 레코드 ID
  userId VARCHAR(255) NOT NULL,       -- 접근한 사용자
  organizationId VARCHAR(255),        -- 조직 ID
  status VARCHAR(20) NOT NULL,        -- ALLOWED, DENIED
  reason VARCHAR(255),                -- 거부 사유
  details JSONB,                      -- 추가 정보 (JSON)
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_audit_log_user_id ON "AuditLog"("userId");
CREATE INDEX idx_audit_log_org_id ON "AuditLog"("organizationId");
CREATE INDEX idx_audit_log_status ON "AuditLog"("status");
CREATE INDEX idx_audit_log_created_at ON "AuditLog"("createdAt" DESC);
CREATE INDEX idx_audit_log_composite ON "AuditLog"("organizationId", "status", "createdAt" DESC);
```

### SecurityEvent 테이블
```sql
CREATE TABLE "SecurityEvent" (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,           -- UNAUTHORIZED_ACCESS, PERMISSION_DENIED, ...
  severity VARCHAR(20) NOT NULL,       -- LOW, MEDIUM, HIGH, CRITICAL
  userId VARCHAR(255) NOT NULL,        -- 이벤트 발생 사용자
  organizationId VARCHAR(255),         -- 조직 ID
  description TEXT NOT NULL,           -- 이벤트 설명
  details JSONB,                       -- 추가 정보
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_security_event_severity ON "SecurityEvent"("severity");
CREATE INDEX idx_security_event_created_at ON "SecurityEvent"("createdAt" DESC);
CREATE INDEX idx_security_event_critical ON "SecurityEvent"("createdAt" DESC)
  WHERE "severity" IN ('CRITICAL', 'HIGH');
```

---

## 🔌 API 통합

### Settlement Summary API
**파일**: `src/app/api/admin/settlement-summary/route.ts`

**통합 내용**:
```typescript
// 1. RLS 권한 검증
const permissionCheck = await checkCommissionLedgerSelectPermission(
  ctx,
  organizationId
);

// 2. 거부된 경우 로깅
if (!permissionCheck.allowed) {
  await logAuditEntry({
    action: 'SELECT',
    table: 'CommissionLedger',
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    status: 'DENIED',
    reason: permissionCheck.reason,
    details: { endpoint: 'settlement-summary' },
    timestamp: new Date(),
  });
  return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
}

// 3. 성공한 경우 로깅
await logAuditEntry({
  action: 'SELECT',
  table: 'CommissionLedger',
  userId: ctx.userId,
  organizationId: ctx.organizationId,
  status: 'ALLOWED',
  details: { endpoint: 'settlement-summary' },
  timestamp: new Date(),
});
```

### Partner Details API
**파일**: `src/app/api/admin/settlements/partner-details/route.ts`

동일한 패턴 적용

---

## 📊 감시 로그 조회 API

### GET /api/admin/audit-logs
감시 로그 조회 (GLOBAL_ADMIN 전용)

**쿼리 파라미터:**
```
- action: SELECT|INSERT|UPDATE|DELETE (선택)
- status: ALLOWED|DENIED (선택)
- userId: 사용자 ID (선택)
- organizationId: 조직 ID (선택)
- startDate: YYYY-MM-DD (선택)
- endDate: YYYY-MM-DD (선택)
- page: 1-based (기본값: 1)
- limit: 1-100 (기본값: 20)
```

**응답:**
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "action": "SELECT",
      "table": "CommissionLedger",
      "recordId": null,
      "userId": "admin-001",
      "organizationId": "org-001",
      "status": "ALLOWED",
      "reason": null,
      "details": { "endpoint": "settlement-summary" },
      "createdAt": "2026-06-01T10:30:45Z"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "pageSize": 20,
    "totalPages": 3
  },
  "performance": {
    "elapsedMs": 145
  }
}
```

### GET /api/admin/security-events
보안 이벤트 조회 (GLOBAL_ADMIN 전용)

**쿼리 파라미터:**
```
- type: UNAUTHORIZED_ACCESS|PERMISSION_DENIED|SUSPICIOUS_ACTIVITY|PRIVILEGE_ESCALATION (선택)
- severity: LOW|MEDIUM|HIGH|CRITICAL (선택)
- userId: 사용자 ID (선택)
- organizationId: 조직 ID (선택)
- startDate: YYYY-MM-DD (선택)
- endDate: YYYY-MM-DD (선택)
- page: 1-based (기본값: 1)
- limit: 1-100 (기본값: 20)
```

**응답:**
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "type": "PERMISSION_DENIED",
      "severity": "HIGH",
      "userId": "agent-001",
      "organizationId": "org-001",
      "description": "CommissionLedger SELECT denied: mismatched organizationId",
      "details": { "requestedOrgId": "org-999" },
      "createdAt": "2026-06-01T10:45:23Z"
    }
  ],
  "pagination": {
    "total": 8,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "stats": {
    "CRITICAL": 1,
    "HIGH": 3,
    "MEDIUM": 2,
    "LOW": 2
  },
  "performance": {
    "elapsedMs": 89
  }
}
```

---

## 🖥️ 감시 대시보드

**경로**: `src/app/(dashboard)/admin/audit-logs/page.tsx`

**기능:**
- 📊 감시 로그 실시간 조회
- 🔍 필터링 (액션, 상태, 심각도, 날짜)
- ⚠️ 보안 이벤트 모니터링
- 📈 이벤트별 통계
- 🎯 CRITICAL/HIGH 심각도 강조 표시

---

## 🧪 테스트

**경로**: `tests/security/settlement-api-authorization.test.ts`

**테스트 시나리오:**

| 시나리오 | 기대 결과 | 상태 |
|---------|----------|------|
| Unauthenticated SELECT | DENIED (UNAUTHENTICATED) | ✅ |
| GLOBAL_ADMIN SELECT | ALLOWED | ✅ |
| OWNER Cross-Org SELECT | DENIED (CROSS_ORGANIZATION_ACCESS) | ✅ |
| OWNER Same-Org SELECT | ALLOWED | ✅ |
| AGENT Same-Profile SELECT | ALLOWED | ✅ |
| AGENT Cross-Profile SELECT | DENIED (CROSS_PROFILE_ACCESS) | ✅ |
| Non-ADMIN INSERT | DENIED (INSUFFICIENT_PRIVILEGE) | ✅ |
| DELETE (all roles) | DENIED (DELETE_NOT_PERMITTED) | ✅ |
| SECURITY_EVENT Logging | Event Created | ✅ |

**테스트 실행:**
```bash
npm test -- settlement-api-authorization.test.ts
```

---

## 🚀 배포 체크리스트

### Phase 3-B 완료 기준

- [x] PostgreSQL RLS 정책 생성 (SQL 마이그레이션)
- [x] Audit Logger 구현 (src/lib/audit-logger.ts)
- [x] AuditLog 테이블 생성
- [x] SecurityEvent 테이블 생성
- [x] Settlement API 통합 (audit logging)
- [x] Audit Logs API 구현 (GET /api/admin/audit-logs)
- [x] Security Events API 구현 (GET /api/admin/security-events)
- [x] 감시 대시보드 UI 구현
- [x] 권한 검증 테스트 작성
- [x] TypeScript 타입 체크 통과
- [ ] 데이터베이스 마이그레이션 실행
- [ ] 통합 테스트 (실제 DB 환경)
- [ ] 실시간 알림 구현 (Slack/Email/SMS)
- [ ] 모니터링 대시보드 배포

---

## 📝 마이그레이션 실행 방법

### 1. SQL 마이그레이션 수동 실행
```bash
# PostgreSQL에 직접 연결
psql -U postgres -h localhost -d mabiz_crm -f prisma/migrations/rls_commission_ledger_policies.sql
```

### 2. Prisma 마이그레이션 통합
```bash
# 새 마이그레이션 생성 (prisma/migrations 폴더)
npx prisma migrate dev --name add_rls_commission_ledger

# 프로덕션 배포
npx prisma migrate deploy
```

### 3. RLS 정책 확인
```sql
-- 적용된 정책 확인
SELECT * FROM pg_policies 
WHERE tablename = 'CommissionLedger';

-- AuditLog 테이블 확인
SELECT COUNT(*) FROM "AuditLog";

-- SecurityEvent 테이블 확인
SELECT COUNT(*) FROM "SecurityEvent";
```

---

## 🔧 문제 해결

### RLS 정책이 적용되지 않는 경우
```sql
-- RLS 활성화 확인
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'CommissionLedger';

-- 비활성화된 경우 활성화
ALTER TABLE "CommissionLedger" ENABLE ROW LEVEL SECURITY;
```

### 성능 이슈 (느린 쿼리)
```sql
-- 인덱스 확인
SELECT * FROM pg_stat_user_indexes 
WHERE relname = 'CommissionLedger';

-- 부족한 인덱스 생성
CREATE INDEX idx_commission_ledger_org_settled_created
  ON "CommissionLedger"("organizationId", "isSettled", "createdAt" DESC);
```

### 감시 로그 공간 부족
```sql
-- 오래된 로그 정리
DELETE FROM "AuditLog" 
WHERE "createdAt" < NOW() - INTERVAL '90 days';

DELETE FROM "SecurityEvent" 
WHERE "createdAt" < NOW() - INTERVAL '90 days';
```

---

## 🎯 향후 개선사항

1. **실시간 알림**
   - Slack 웹훅 통합
   - 이메일 발송
   - SMS 경고
   - 관리자 푸시 알림

2. **이상 탐지**
   - 비정상적인 접근 패턴 감지
   - 자동 계정 잠금
   - 조사 워크플로우

3. **규정 준수**
   - GDPR 데이터 포털
   - 삭제 요청 자동화
   - 규정 준수 리포트 생성

4. **성능 최적화**
   - 감시 로그 파티셔닝
   - 비동기 로깅
   - 배치 처리

5. **통합**
   - SIEM 통합 (Splunk, ELK)
   - 보안팀 대시보드
   - 자동 위협 응답

---

## 📚 참고 문서

- [PostgreSQL RLS 공식 문서](https://www.postgresql.org/docs/current/sql-createpolicy.html)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [CIS PostgreSQL Benchmarks](https://www.cisecurity.org/cis-benchmarks/)
- [GCP Security Best Practices](https://cloud.google.com/security/best-practices)

---

## 📞 지원

문제 발생 시:
1. 감시 대시보드에서 최근 보안 이벤트 확인
2. 감시 로그 API에서 상세 정보 조회
3. 콘솔 로그 (`logger.error`) 확인
4. 데이터베이스 마이그레이션 상태 확인

---

**마지막 업데이트**: 2026-06-01  
**버전**: 1.0.0  
**상태**: ✅ 구현 완료
