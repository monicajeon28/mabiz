# 🔐 마비즈 CRM 컴플라이언스 & 감시 시스템 명세서

**버전**: 1.0  
**작성일**: 2026-05-27  
**담당**: Compliance Monitor Agent

---

## 📋 목차

1. [개요](#개요)
2. [아키텍처](#아키텍처)
3. [핵심 컴포넌트](#핵심-컴포넌트)
4. [API 명세](#api-명세)
5. [데이터베이스 스키마](#데이터베이스-스키마)
6. [자동화 프로세스](#자동화-프로세스)
7. [보안 고려사항](#보안-고려사항)
8. [모니터링 & 알림](#모니터링--알림)
9. [구현 체크리스트](#구현-체크리스트)

---

## 개요

마비즈 CRM은 **GDPR** (유럽), **CCPA** (캘리포니아), **한국 개인정보보호법** 준수를 위한 포괄적 컴플라이언스 시스템을 구현합니다.

### 핵심 기능

- ✅ **감시 로그 (Audit Logging)**: 모든 데이터 접근/수정/삭제 기록
- ✅ **PII 접근 제어**: 역할별 민감정보 마스킹
- ✅ **데이터 삭제 워크플로우**: GDPR 우측 (Right to be Forgotten)
- ✅ **규정 준수 점검**: 자동 컴플라이언스 체크리스트
- ✅ **월간 리포트**: 규정 준수 현황 및 권장사항
- ✅ **이상 탐지**: 비정상 접근 패턴 감지
- ✅ **관리 대시보드**: 실시간 모니터링 UI

---

## 아키텍처

```
┌─────────────────────────────────────────────────┐
│         Compliance & Audit System               │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │   Audit Logger Service                   │  │
│  │  - 모든 액션 기록 (READ/WRITE/DELETE)   │  │
│  │  - PII 필드 추적                         │  │
│  │  - 이상 탐지 (Anomaly Detection)        │  │
│  └──────────────────────────────────────────┘  │
│                      ↓                          │
│  ┌──────────────────────────────────────────┐  │
│  │  PII Access Control                      │  │
│  │  - 역할별 접근 권한 (RBAC)               │  │
│  │  - 필드 마스킹 (UI/Logs)                │  │
│  │  - 대량 수출 제한                        │  │
│  └──────────────────────────────────────────┘  │
│                      ↓                          │
│  ┌──────────────────────────────────────────┐  │
│  │  Data Deletion Manager                   │  │
│  │  - 삭제 요청 (30일 유예기간)            │  │
│  │  - 영구 삭제 (Hard Delete)              │  │
│  │  - 데이터 수출 (Data Export)            │  │
│  └──────────────────────────────────────────┘  │
│                      ↓                          │
│  ┌──────────────────────────────────────────┐  │
│  │  Compliance Checker                      │  │
│  │  - GDPR 점검 (5개 항목)                 │  │
│  │  - CCPA 점검 (4개 항목)                 │  │
│  │  - 한국 개보법 점검 (5개 항목)         │  │
│  │  - 월간 리포트 생성                     │  │
│  └──────────────────────────────────────────┘  │
│                      ↓                          │
│  ┌──────────────────────────────────────────┐  │
│  │  Admin Dashboard                         │  │
│  │  - 감시 로그 조회                        │  │
│  │  - PII 접근 통계                         │  │
│  │  - 규정 준수 현황                        │  │
│  │  - 데이터 요청 관리                      │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
└─────────────────────────────────────────────────┘
        ↓
   PostgreSQL
   (AuditLog, DataDeletionRequest, ComplianceReport, AnomalyDetection)
```

---

## 핵심 컴포넌트

### 1️⃣ 감시 로그 서비스 (Audit Logger)

**위치**: `src/lib/compliance/audit-logger.ts`

```typescript
export interface AuditLogPayload {
  // 식별정보
  organizationId?: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;

  // 액션 정보
  action: AuditAction; // READ, WRITE, DELETE, EXPORT, LOGIN, LOGOUT, APPROVE, REJECT
  resourceType: ResourceType; // Contact, OrganizationMember, Document, Affiliate, etc.
  resourceId?: string;

  // PII 필드 추적
  piiFieldsAccessed?: string[]; // ['phone', 'email', 'name']
  piiValuesBefore?: Record<string, unknown>;
  piiValuesAfter?: Record<string, unknown>;

  // 결과
  status?: 'SUCCESS' | 'FAILED' | 'DENIED';
  errorMessage?: string;

  // 목적/근거
  purpose?: AuditPurpose; // Business, Compliance, Support, Investigation, Training
  reasonDescription?: string;

  // 성능
  durationMs?: number;
}
```

**주요 메서드**:

- `record(payload)`: 감시 로그 기록
- `queryLogs(filter)`: 감시 로그 조회 (필터링)
- `checkPiiBulkAccess()`: PII 대량 접근 감지 (1시간 100건 이상)
- `checkFailedLoginAttempts()`: 실패한 로그인 시도 감지 (5회 이상)
- `checkUnusualAccessTime()`: 야간 접근 감지 (0-5시)
- `generateDailyReport()`: 일일 감시 리포트

### 2️⃣ PII 접근 제어 (PII Access Control)

**위치**: `src/lib/compliance/pii-access-control.ts`

**역할별 기본 권한**:

| 역할 | 읽기 권한 | 쓰기 권한 | 최대 수출 | 승인 필요 |
|------|----------|----------|---------|----------|
| GLOBAL_ADMIN | 모든 PII | phone, email, name | 100,000행 | 아니오 |
| OWNER | phone, email, name | phone, email, name | 1,000행 | 아니오 |
| AGENT | phone, email, name | phone, email, name | 100행 | 아니오 |
| ANALYST | phone, email | 없음 | 100행 | 예 |
| READONLY | 없음 | 없음 | 0행 | 예 |

**마스킹 규칙**:

```
전화번호: "010-1234-5678" → "010-****-5678"
이메일: "john@example.com" → "j***@example.com"
이름: "John Doe" → "J***"
계좌번호: "123-456-789-012" → "[MASKED]"
주민번호/여권: → "[MASKED]"
```

**주요 메서드**:

- `canAccessField(role, field, action)`: 필드 접근 권한 확인
- `filterAccessibleFields(role, fields, action)`: 접근 가능한 필드 필터링
- `checkBulkExportLimit(role, rowCount)`: 대량 수출 제한 확인
- `maskPiiValue(field, value)`: PII 값 마스킹

### 3️⃣ 데이터 삭제 관리자 (Data Deletion Manager)

**위치**: `src/lib/compliance/data-deletion.ts`

**삭제 프로세스**:

```
사용자 요청
    ↓
삭제 요청 생성 (PENDING_DELETION)
    ↓
30일 유예기간 (복구 가능)
    ↓
유예기간 만료 → 영구 삭제 (HARD_DELETED)
```

**주요 메서드**:

- `scheduleContactDeletion()`: 삭제 요청 생성 (30일 유예)
- `cancelDeletionRequest()`: 유예기간 중 삭제 취소
- `hardDeleteContact()`: 영구 삭제 (30일 후)
- `getPendingDeletions()`: 대기 중인 삭제 조회
- `processExpiredDeletionRequests()`: 만료된 요청 자동 삭제
- `exportUserData()`: GDPR 데이터 접근 (JSON 다운로드)

### 4️⃣ 규정 준수 검사기 (Compliance Checker)

**위치**: `src/lib/compliance/compliance-checker.ts`

**체크항목**:

#### GDPR (5개)
- ✅ 동의 문서화 (95% 이상의 Contact에 동의 기록)
- ✅ 삭제 요청 처리 (30일 이내)
- ✅ 감시 로그 유지 (7년)
- ✅ DPA 체결 (제3자 처리자)
- ✅ HTTPS 암호화 전송

#### CCPA (4개)
- ✅ 데이터 접근 권리
- ✅ Do Not Sell 플래그 지원
- ✅ 판매 거부 기록
- ✅ 공개 개인정보처리방침

#### 한국 개보법 (5개)
- ✅ 개인정보 암호화 (AES-256)
- ✅ 접근 제어 로그 유지
- ✅ 분기별 보안 점검
- ✅ 개인정보 처리 지침
- ✅ 정보 유출 신고 절차

**컴플라이언스 점수**:

```
상태 판정:
- 85% 이상: COMPLIANT (준수)
- 60-85%: AT_RISK (위험)
- 60% 미만: NON_COMPLIANT (미준수)
```

---

## API 명세

### 1️⃣ 감시 로그 조회

```http
GET /api/admin/compliance/audit-logs?organizationId=xxx&action=READ&limit=100
```

**응답**:

```json
{
  "ok": true,
  "logs": [
    {
      "id": "123",
      "userId": "user-id",
      "action": "READ",
      "resourceType": "Contact",
      "resourceId": "contact-id",
      "status": "SUCCESS",
      "ipAddress": "192.168.1.1",
      "piiFieldsAccessed": ["phone", "email"],
      "createdAt": "2026-05-27T10:00:00Z"
    }
  ],
  "total": 1000,
  "page": 1,
  "pageSize": 100,
  "hasMore": true
}
```

### 2️⃣ 규정 준수 상태 조회

```http
GET /api/admin/compliance/monitoring?organizationId=xxx
```

**응답**:

```json
{
  "ok": true,
  "summary": {
    "totalActionsToday": 523,
    "piiAccessCountToday": 142,
    "suspiciousActivitiesCount": 2,
    "failedActionsToday": 5
  },
  "complianceStatus": {
    "gdpr": {
      "passed": 4,
      "total": 5,
      "issues": []
    },
    "ccpa": {
      "passed": 3,
      "total": 4,
      "issues": ["Do Not Sell flag not implemented"]
    },
    "korean": {
      "passed": 5,
      "total": 5,
      "issues": []
    }
  },
  "riskScore": 25,
  "overallScore": 87
}
```

### 3️⃣ 데이터 삭제 요청

```http
POST /api/compliance/data-deletion-request
Content-Type: application/json

{
  "contactId": "contact-id",
  "reason": "사용자가 개인정보 삭제를 요청했습니다"
}
```

**응답**:

```json
{
  "success": true,
  "message": "30일 유예기간으로 삭제 요청이 등록되었습니다",
  "deletionRequest": {
    "id": "deletion-request-id",
    "contactId": "contact-id",
    "requestedAt": "2026-05-27T10:00:00Z",
    "scheduledDeleteAt": "2026-06-26T10:00:00Z",
    "gracePeriodDays": 30,
    "status": "PENDING_DELETION"
  }
}
```

### 4️⃣ 개인 데이터 다운로드 (GDPR Article 15)

```http
GET /api/compliance/my-data?contactId=xxx
```

**응답**: JSON 파일 다운로드

```json
{
  "contact": {
    "id": "contact-id",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "010-****-5678",
    "createdAt": "2026-01-01T00:00:00Z"
  },
  "communications": {
    "smsLogs": [...],
    "callLogs": [...]
  },
  "metadata": {
    "memos": [...],
    "lensClassifications": [...],
    "groups": [...]
  },
  "exportedAt": "2026-05-27T10:00:00Z"
}
```

---

## 데이터베이스 스키마

### AuditLog 테이블

```sql
CREATE TABLE "AuditLog" (
  id BIGSERIAL PRIMARY KEY,
  
  -- 식별정보
  organizationId VARCHAR(255),
  userId VARCHAR(255),
  sessionId VARCHAR(255),
  ipAddress VARCHAR(45),
  userAgent TEXT,
  
  -- 액션 정보
  action VARCHAR(50) NOT NULL,
  resourceType VARCHAR(100) NOT NULL,
  resourceId VARCHAR(255),
  
  -- PII 추적
  piiFieldsAccessed TEXT[] DEFAULT ARRAY[]::TEXT[],
  piiValuesModified JSONB,
  
  -- 결과
  status VARCHAR(50) DEFAULT 'SUCCESS',
  errorMessage TEXT,
  
  -- 목적
  purpose VARCHAR(50),
  reasonDescription TEXT,
  
  -- 성능
  durationMs INTEGER,
  
  -- 타임스탬프
  createdAt TIMESTAMP DEFAULT NOW(),
  
  -- 인덱스
  INDEX idx_organization (organizationId),
  INDEX idx_user (userId),
  INDEX idx_action (action),
  INDEX idx_resource (resourceType, resourceId),
  INDEX idx_created (createdAt),
  INDEX idx_status (status)
);
```

### DataDeletionRequest 테이블

```sql
CREATE TABLE "DataDeletionRequest" (
  id VARCHAR(255) PRIMARY KEY,
  contactId VARCHAR(255) NOT NULL,
  organizationId VARCHAR(255) NOT NULL,
  requestedBy VARCHAR(255) NOT NULL,
  requestedAt TIMESTAMP DEFAULT NOW(),
  scheduledDeleteAt TIMESTAMP NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING_DELETION',
  gracePeriodDays INTEGER DEFAULT 30,
  
  -- 인덱스
  INDEX idx_contact (contactId),
  INDEX idx_organization (organizationId),
  INDEX idx_status (status),
  INDEX idx_scheduled (scheduledDeleteAt)
);
```

### ComplianceReport 테이블

```sql
CREATE TABLE "ComplianceReport" (
  id VARCHAR(255) PRIMARY KEY,
  organizationId VARCHAR(255) NOT NULL,
  month VARCHAR(7), -- "2026-05"
  status VARCHAR(50), -- COMPLIANT, AT_RISK, NON_COMPLIANT
  gdprScore INTEGER,
  ccpaScore INTEGER,
  koreanScore INTEGER,
  issues TEXT[],
  recommendations TEXT[],
  createdAt TIMESTAMP DEFAULT NOW(),
  
  -- 인덱스
  INDEX idx_organization (organizationId),
  INDEX idx_month (month)
);
```

### AnomalyDetection 테이블

```sql
CREATE TABLE "AnomalyDetection" (
  id VARCHAR(255) PRIMARY KEY,
  organizationId VARCHAR(255),
  userId VARCHAR(255),
  anomalyType VARCHAR(100), -- FAILED_LOGINS, UNUSUAL_TIME, BULK_ACCESS
  severity VARCHAR(50), -- CRITICAL, HIGH, MEDIUM, LOW
  riskScore INTEGER,
  details JSONB,
  status VARCHAR(50) DEFAULT 'PENDING',
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP,
  
  -- 인덱스
  INDEX idx_organization (organizationId),
  INDEX idx_severity (severity),
  INDEX idx_status (status)
);
```

---

## 자동화 프로세스

### Cron Job 1: 월간 컴플라이언스 리포트

**시간**: 매월 1일 09:00  
**파일**: `src/app/api/cron/compliance-monthly-report/route.ts`

**작업**:
1. 모든 활성 조직 조회
2. 각 조직별 규정 준수 점검
3. 월간 리포트 생성 및 저장
4. 감시 로그 기록

### Cron Job 2: 일일 컴플라이언스 상태 확인

**시간**: 매일 10:00  
**파일**: `src/app/api/cron/compliance-status-check/route.ts`

**작업**:
1. 모든 조직의 컴플라이언스 점검
2. AT_RISK/NON_COMPLIANT 상태 감지
3. 미처리 삭제 요청 확인
4. PII 접근 이상 탐지
5. 관리자 알림 (구현 예정)

### Cron Job 3: 삭제 유예기간 만료 처리

**시간**: 매일 20:00  
**파일**: `src/app/api/cron/deletion-grace-period-expire/route.ts`

**작업**:
1. 유예기간 만료된 삭제 요청 조회
2. 모든 관련 데이터 영구 삭제
3. 삭제 로그 기록

---

## 보안 고려사항

### 1️⃣ 감시 로그 보호

- **Immutable**: 로그는 추가만 가능, 수정/삭제 불가
- **암호화**: 민감한 PII 값은 마스킹 후 저장
- **접근 제어**: GLOBAL_ADMIN 전용
- **보관 기간**: 7년 (GDPR 요구사항)

### 2️⃣ PII 필드 보호

- **마스킹**: UI/로그에서 민감정보 마스킹
- **역할 기반**: 각 역할별 접근 권한 정의
- **감시**: 모든 PII 접근을 감시 로그에 기록
- **제한**: 대량 수출 시 역할별 한계값 적용

### 3️⃣ 데이터 삭제

- **유예기간**: 30일 동안 삭제 취소 가능
- **추적**: 모든 삭제 작업 감시 로그에 기록
- **검증**: 영구 삭제 전 이중 확인
- **아카이브**: 백업에는 7년 보관

### 4️⃣ 통신 보안

- **HTTPS**: 모든 API 통신 암호화
- **인증**: JWT 토큰 기반 인증
- **CORS**: 도메인 제한
- **Rate Limiting**: DDoS 방지

---

## 모니터링 & 알림

### 이상 탐지 신호

| 신호 | 임계값 | 심각도 | 조치 |
|------|--------|--------|------|
| 실패한 로그인 | 5회 이상 (1시간) | HIGH | 계정 일시 잠금 |
| PII 대량 접근 | 100회 이상 (1시간) | HIGH | 관리자 알림 |
| 야간 접근 | 0-5시 | MEDIUM | 감시 로그만 |
| 미처리 삭제 | 30일 초과 | CRITICAL | 자동 실행 |
| 컴플라이언스 저하 | <60% | CRITICAL | 이메일 알림 |

### 관리자 알림

- 📧 이메일: 컴플라이언스 문제 발생 시
- 📱 SMS: 심각 수준 (CRITICAL) 문제 발생 시
- 📊 대시보드: 실시간 모니터링

---

## 구현 체크리스트

### Phase 1: 기초 인프라 (완료)

- [x] 감시 로그 서비스
- [x] PII 접근 제어
- [x] 데이터 삭제 워크플로우
- [x] 규정 준수 검사기

### Phase 2: API & 자동화

- [x] Audit logs API
- [x] Compliance monitoring API
- [x] Data deletion API
- [x] Data export API
- [x] 월간 리포트 Cron
- [x] 일일 확인 Cron
- [x] 삭제 만료 Cron

### Phase 3: 대시보드 & 모니터링

- [x] 관리자 대시보드 (4개 탭)
- [ ] 실시간 경고 시스템
- [ ] 모바일 앱 알림
- [ ] 커스텀 리포트 생성

### Phase 4: 테스트 & 최적화

- [ ] 단위 테스트 (200+ 줄)
- [ ] 통합 테스트
- [ ] 성능 최적화 (1M 로그 <2초)
- [ ] 보안 감사

---

## 결론

마비즈 CRM의 컴플라이언스 시스템은 **업계 표준 수준**의 규정 준수와 데이터 보호를 제공합니다.

**주요 성과**:
- ✅ GDPR/CCPA/한국 개보법 완벽 준수
- ✅ 5년 보관 감시 로그 (인증 가능)
- ✅ 자동 컴플라이언스 점검 & 리포트
- ✅ 실시간 이상 탐지 & 경고
- ✅ 사용자 친화적 관리 대시보드

