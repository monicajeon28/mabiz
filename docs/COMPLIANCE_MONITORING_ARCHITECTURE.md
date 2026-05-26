# 마비즈 CRM 규정 준수 & 감시 시스템 (Compliance Monitoring)

## 📋 목차

1. [시스템 개요](#시스템-개요)
2. [현재 상태 분석](#현재-상태-분석)
3. [인프라 설계](#인프라-설계)
4. [구현 완료 항목](#구현-완료-항목)
5. [즉시 연결 작업](#즉시-연결-작업)
6. [중장기 로드맵](#중장기-로드맵)

---

## 시스템 개요

### 목표
4개 카테고리(Admin, Analytics, Year-End-Report, Documents)에서 PII(개인식별정보) 접근을 중앙에서 감시하고, GDPR/CCPA 규정을 자동으로 준수하는 시스템 구축.

### 3대 기둥
1. **🔐 PII 접근 제어 (RBAC)** — Role 기반 필드 읽기/쓰기 권한 관리
2. **📊 중앙 감시 로그** — 모든 PII 접근 기록 (5년 보관)
3. **🚨 이상 탐지** — 실시간 위험도 모니터링 + 자동 경고

---

## 현재 상태 분석

### ✅ 기존 인프라 (부분적으로 존재)

| 항목 | 현재 상태 | 문제점 |
|-----|---------|--------|
| **감시 로그** | `AffiliateAuditLog`, `ContractTemplateAuditLog` 존재 | 특정 도메인만 기록, 중앙화 미흡 |
| **RBAC** | `getAuthContext()`, `buildContactWhere()` 존재 | PII 필드별 세분화 없음 |
| **Admin 페이지** | 8개 페이지 (affiliate, backup, groups 등) | PII 접근 제어 없음 |
| **Analytics** | cost 대시보드만 존재 | 감시 로그 조회 없음 |
| **Year-End Report** | 판매 현황 리포트 존재 | 규정 준수 항목 없음 |
| **Documents** | 문서 관리 기능만 존재 | 접근 로그 없음 |

### ❌ 누락된 부분

| 항목 | 현황 | 영향도 |
|-----|------|--------|
| 중앙 감시 로그 테이블 (`AuditLog`) | 미구현 | **P0 - Critical** |
| PII 필드별 접근 정책 테이블 | 미구현 | **P0 - Critical** |
| 이상 탐지 엔진 (Anomaly Detection) | 미구현 | **P1 - High** |
| Compliance Dashboard | 미구현 | **P1 - High** |
| GDPR/CCPA 체크리스트 | 미구현 | **P2 - Medium** |
| 데이터 백업 증명 시스템 | 미구현 | **P2 - Medium** |
| 감시 로그 → API 연결 | 미구현 | **P0 - Critical** |

---

## 인프라 설계

### 1️⃣ 데이터베이스 모델 (7개 테이블)

#### `AuditLog` — 중앙 감시 로그
```prisma
model AuditLog {
  id: BigInt @id
  organizationId: String
  userId: String
  action: String  // "READ", "WRITE", "DELETE", "EXPORT", "LOGIN"
  resourceType: String  // "Contact", "OrganizationMember", "Document"
  piiFieldsAccessed: String[]  // ["phone", "email"]
  status: String  // "SUCCESS", "FAILED", "DENIED"
  createdAt: DateTime @index([organizationId, createdAt])
}
```

**특징**:
- 월별 파티셔닝 (자동 성능 최적화)
- 5년 보관, 이후 자동 아카이빙
- 복합 인덱스 (org + time, action, PII fields)

#### `PiiAccessPolicy` — 역할별 PII 접근 권한
```prisma
model PiiAccessPolicy {
  organizationId: String
  roleName: String  // "GLOBAL_ADMIN", "OWNER", "AGENT", "ANALYST"
  allowedPiiFields: String[]  // ["phone", "email", "name"]
  modifiablePiiFields: String[]  // ["name"]
  maxBulkExportRows: Int  // 대량 수출 제한
}
```

#### `AnomalyDetection` — 이상 활동 기록
```prisma
model AnomalyDetection {
  id: Int
  userId: String
  anomalyType: String  // "UNUSUAL_IP", "BULK_DOWNLOAD", "FAILED_LOGINS"
  riskScore: Int  // 0-100
  severity: String  // "LOW", "MEDIUM", "HIGH", "CRITICAL"
}
```

#### `ComplianceChecklist` — 규정 준수 체크리스트
```prisma
model ComplianceChecklist {
  regulationType: String  // "GDPR", "CCPA", "HIPAA"
  items: Json  // [{ "id": "gdpr_1", "name": "...", "completed": true }]
  completionRate: Int  // 0-100%
}
```

#### 추가 테이블
- `ComplianceRule` — 실시간 이상 탐지 규칙
- `BackupAuditTrail` — 일일/주간/월간 백업 증명
- `DataAccessRequest` — GDPR 데이터 요청 (내보내기/삭제) 추적

### 2️⃣ 핵심 라이브러리

#### `AuditLogger` — 감시 로그 기록 (`src/lib/compliance/audit-logger.ts`)

```typescript
// 사용 예시
await auditLogger.record({
  organizationId: ctx.organizationId,
  userId: ctx.userId,
  action: 'READ',
  resourceType: 'Contact',
  piiFieldsAccessed: ['phone', 'email', 'name'],
  purpose: 'Business',
});
```

**주요 메서드**:
- `record()` — PII 접근 로그 기록 (마스킹 포함)
- `queryLogs()` — 필터링된 로그 조회 (관리자용)
- `checkPiiBulkAccess()` — 대량 PII 접근 탐지
- `checkFailedLoginAttempts()` — 실패한 로그인 시도 감지
- `checkUnusualAccessTime()` — 야간 접근 탐지 (0-5시)
- `generateDailyReport()` — 일일 감시 리포트

#### `PiiAccessControl` — PII 필드 접근 제어 (`src/lib/compliance/pii-access-control.ts`)

```typescript
// 사용 예시: 필드별 읽기 권한 확인
const canRead = await piiAccessControl.canAccessField(
  'AGENT',  // 역할
  'phone',  // 필드
  'read',   // 액션
  organizationId
);

// 여러 필드 필터링
const accessible = await piiAccessControl.filterAccessibleFields(
  'AGENT',
  ['phone', 'email', 'bankAccount', 'idNumber'],
  'read',
  organizationId
);
// 결과: ['phone', 'email'] (bankAccount, idNumber는 AGENT 접근 불가)

// 대량 수출 제한 확인
const bulkCheck = await piiAccessControl.checkBulkExportLimit(
  'AGENT',
  10000,  // 수출 행 수
  organizationId
);
// 결과: { allowed: false, reason: '수출 제한: 최대 100행까지만 가능' }
```

**주요 메서드**:
- `canAccessField()` — 단일 필드 접근 권한 확인
- `filterAccessibleFields()` — 접근 가능한 필드 목록 필터링
- `checkBulkExportLimit()` — 대량 데이터 수출 제한 검사
- `checkQueryResultLimit()` — 쿼리 결과 크기 제한 검사
- `maskPiiValue()` — PII 값 마스킹 (UI 출력용)

**역할별 기본 권한**:

| 역할 | 읽기 가능 필드 | 쓰기 가능 필드 | 최대 수출 | 최대 쿼리 |
|------|---------------|---------------|----------|----------|
| **GLOBAL_ADMIN** | 모든 필드 | [phone, email, name] | 100,000 | 100,000 |
| **OWNER** | [phone, email, name] | [phone, email, name] | 1,000 | 10,000 |
| **AGENT** | [phone, email, name] | [phone, email, name] | 100 | 1,000 |
| **ANALYST** | [phone, email] | [] (읽기만) | 100 | 1,000 |
| **READONLY** | [] (모두 거부) | [] | 0 | 100 |

### 3️⃣ API 엔드포인트

#### 1. Compliance Monitoring Dashboard
```
GET /api/admin/compliance/monitoring?organizationId=...&daysBack=7

응답:
{
  ok: true,
  summary: {
    totalActionsToday: 1234,
    piiAccessCountToday: 45,
    suspiciousActivitiesCount: 2,
    failedActionsToday: 3,
    failedLoginAttemptsToday: 1,
  },
  recentAnomalies: [
    {
      id: 1,
      anomalyType: "BULK_DOWNLOAD",
      severity: "CRITICAL",
      riskScore: 85,
      status: "PENDING",
      createdAt: "2026-05-27T...",
    }
  ],
  complianceStatus: {
    gdpr: { completionRate: 62, items: [...] },
    ccpa: { completionRate: 45, items: [...] },
  },
  riskScore: 58,
  riskFactors: {
    failedLoginAttempts: 10,
    suspiciousActivities: 30,
    failedAuditActions: 8,
    complianceGap: 38,
  },
}
```

#### 2. Audit Log Query API
```
GET /api/admin/compliance/audit-logs
  ?organizationId=...
  &userId=...
  &action=READ
  &status=SUCCESS
  &startDate=2026-05-20
  &endDate=2026-05-27
  &limit=100
  &offset=0

응답:
{
  ok: true,
  logs: [
    {
      id: 1234567890,
      action: "READ",
      resourceType: "Contact",
      userId: "user123",
      ipAddress: "192.168.1.100",
      status: "SUCCESS",
      piiFieldsAccessed: ["phone", "email"],
      createdAt: "2026-05-27T10:30:00Z",
    }
  ],
  total: 5234,
  page: 1,
  pageSize: 100,
  hasMore: true,
}
```

### 4️⃣ UI 대시보드

#### Compliance Monitoring Page
(`/admin/compliance-monitoring`)

**표시 항목**:
- 📊 실시간 위험도 점수 (0-100)
- 📈 오늘의 활동 요약 (4개 카드)
- 🚨 최근 이상 활동 (최신 10건)
- 📋 규정 준수 체크리스트 (GDPR/CCPA/내규)
- 👤 상위 PII 접근 사용자 (Top 5)
- ⚠️ 위험 요소 분석 (4가지 시각화)

**새로고침**: 자동으로 5분마다 새로고침

#### Audit Log Page
(`/admin/audit-logs`)

**기능**:
- 📋 감시 로그 테이블 (시간, 사용자, 액션, 리소스, PII 필드, 상태, IP)
- 🔍 고급 필터 (사용자ID, 액션, 상태, 날짜 범위)
- 📄 상세보기 모달 (전체 정보 + 에러 메시지)
- 📊 페이지네이션 (25/50/100 결과)

---

## 구현 완료 항목

### ✅ Phase 1: 인프라 (2026-05-27 완료)

| 항목 | 파일 | 상태 |
|-----|------|------|
| Prisma 모델 (7개 테이블) | `prisma/schema.prisma` | ✅ 완료 |
| SQL 초기화 스크립트 | `prisma/migrations/compliance_audit_infrastructure.sql` | ✅ 완료 |
| AuditLogger 클래스 | `src/lib/compliance/audit-logger.ts` | ✅ 완료 |
| PiiAccessControl 클래스 | `src/lib/compliance/pii-access-control.ts` | ✅ 완료 |
| Monitoring API | `src/app/api/admin/compliance/monitoring/route.ts` | ✅ 완료 |
| Audit Logs API | `src/app/api/admin/compliance/audit-logs/route.ts` | ✅ 완료 |
| Compliance Dashboard UI | `src/app/(dashboard)/admin/compliance-monitoring/page.tsx` | ✅ 완료 |
| Audit Logs UI | `src/app/(dashboard)/admin/audit-logs/page.tsx` | ✅ 완료 |

---

## 즉시 연결 작업 (Phase 2: 통합)

### 🔴 P0 - Critical (5-7일 소요)

#### 1. Admin API 감시 로그 연결
각 `/api/admin/*` 엔드포인트에 `auditLogger.record()` 추가:

```typescript
// 예: /api/admin/organizations/route.ts
export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  
  try {
    // ... 기존 로직 ...
    
    // ✨ 감시 로그 기록 추가
    await auditLogger.record({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'READ',
      resourceType: 'Organization',
      piiFieldsAccessed: [/* 실제 읽은 필드 */],
      purpose: 'Business',
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    // ... 에러 처리 ...
  }
}
```

**해당 파일 (8개)**:
- `src/app/api/admin/organizations/route.ts`
- `src/app/api/admin/affiliate-managers/route.ts`
- `src/app/api/admin/affiliate-managers/[memberId]/route.ts`
- `src/app/api/admin/affiliate-sales/route.ts`
- `src/app/api/admin/groups-stats/route.ts`
- `src/app/api/admin/partner-applications/route.ts`
- `src/app/api/admin/sending-monitor/route.ts`
- `src/app/api/admin/backup-status/route.ts`

#### 2. Admin 페이지에 PII 접근 제어 추가
각 admin UI에서 민감한 필드 필터링:

```typescript
// 예: /admin/organizations 페이지
const accessibleFields = await piiAccessControl.filterAccessibleFields(
  ctx.role,
  ['phone', 'email', 'bankAccount'],
  'read',
  ctx.organizationId
);

// UI에서 접근 가능한 필드만 표시
const displayData = {
  ...data,
  phone: accessibleFields.includes('phone') ? data.phone : '[접근 불가]',
  email: accessibleFields.includes('email') ? data.email : '[접근 불가]',
};
```

#### 3. Contact CRUD 작업 감시 추가
`src/app/api/contacts/*` 엔드포인트에 감시 로그 추가:

```typescript
// Contact 읽기
await auditLogger.record({
  organizationId: ctx.organizationId,
  userId: ctx.userId,
  action: 'READ',
  resourceType: 'Contact',
  resourceId: contactId,
  piiFieldsAccessed: ['phone', 'email', 'name'],
});

// Contact 수정
await auditLogger.record({
  organizationId: ctx.organizationId,
  userId: ctx.userId,
  action: 'WRITE',
  resourceType: 'Contact',
  resourceId: contactId,
  piiFieldsAccessed: ['phone', 'email'],
  piiValuesBefore: { phone: oldPhone, email: oldEmail },
  piiValuesAfter: { phone: newPhone, email: newEmail },
});

// Contact 삭제
await auditLogger.record({
  organizationId: ctx.organizationId,
  userId: ctx.userId,
  action: 'DELETE',
  resourceType: 'Contact',
  resourceId: contactId,
  purpose: 'Compliance',
});
```

#### 4. 데이터 수출 제한 구현
모든 CSV/Excel 수출 API에서:

```typescript
const bulkCheck = await piiAccessControl.checkBulkExportLimit(
  ctx.role,
  rowCount,
  ctx.organizationId
);

if (!bulkCheck.allowed) {
  return NextResponse.json(
    { ok: false, error: bulkCheck.reason },
    { status: 403 }
  );
}

// 감시 로그 기록
await auditLogger.record({
  organizationId: ctx.organizationId,
  userId: ctx.userId,
  action: 'EXPORT',
  resourceType: 'Contact',
  piiFieldsAccessed: ['phone', 'email', 'name'],
  purpose: 'Business',
});
```

### 🟠 P1 - High (7-10일 소요)

#### 5. Login/Logout 감시 추가
`src/lib/auth.ts` 또는 인증 미들웨어에:

```typescript
// 로그인 시도
await auditLogger.record({
  userId: email,
  action: 'LOGIN',
  resourceType: 'Session',
  status: 'SUCCESS', // 또는 'FAILED'
  ipAddress: req.ip,
});

// 로그인 실패 검사
const failedAttempts = await auditLogger.checkFailedLoginAttempts(
  email,
  60  // 1시간
);

if (failedAttempts >= 5) {
  // 계정 잠금 또는 추가 인증
}
```

#### 6. 규정 준수 체크리스트 초기화
각 조직별 자동 생성:

```typescript
// 신규 조직 생성 시 실행
await prisma.complianceChecklist.create({
  data: {
    organizationId,
    regulationType: 'GDPR',
    items: {
      items: [
        { id: 'gdpr_1', name: 'Data Request Handler', completed: false },
        { id: 'gdpr_2', name: 'Right to Delete', completed: false },
        // ... (8개 항목)
      ]
    },
  },
});
```

#### 7. 일일 감시 리포트 자동 생성
Cron 작업 (매일 9AM UTC):

```typescript
// src/lib/cron/daily-compliance-report.ts
export async function generateDailyComplianceReport() {
  const orgs = await prisma.organization.findMany({
    select: { id: true },
  });

  for (const org of orgs) {
    const report = await auditLogger.generateDailyReport(org.id);
    
    // Slack/Email 알림 (옵션)
    if (report.suspiciousActivities > 0) {
      await notifyAdmins(`[${org.id}] 의심 활동 ${report.suspiciousActivities}건 발생`);
    }
  }
}
```

### 🟡 P2 - Medium (10-14일 소요)

#### 8. Analytics 대시보드 확장
기존 `/admin/analytics/cost`에 감시 항목 추가:

```typescript
// /admin/analytics/monitoring (새 페이지)
- 시간별 PII 접근 차트
- 사용자별 액션 분포
- 상위 위험 활동
- 주간 규정 준수율
```

#### 9. Year-End Report에 규정 준수 항목 추가
`src/app/(dashboard)/year-end-report/page.tsx`:

```typescript
// 추가할 섹션
- GDPR 준수율 (%)
- 데이터 요청 처리 현황 (건)
- 보안 사건 기록
- 백업 검증 현황
- 감시 로그 통계
```

#### 10. Documents 페이지에 접근 로깅 추가
`src/app/(dashboard)/documents/*`에:

```typescript
// 문서 다운로드 시
await auditLogger.record({
  organizationId: ctx.organizationId,
  userId: ctx.userId,
  action: 'EXPORT',
  resourceType: 'Document',
  resourceId: documentId,
  piiFieldsAccessed: isPersonalDoc ? ['email', 'phone'] : [],
});
```

---

## 중장기 로드맵

### Phase 3: 고급 기능 (4주)

| 순번 | 기능 | 예상 효과 |
|------|------|---------|
| 1️⃣ | ML 기반 이상 탐지 (Isolation Forest) | 오탐 10% 감소 |
| 2️⃣ | GDPR 데이터 요청 자동 처리 (API) | 처리 시간 30일 → 1일 |
| 3️⃣ | 데이터 맵핑 (어떤 필드가 어디 저장되는가) | GDPR 제29조 준수 |
| 4️⃣ | 자동 암호화 (Rest + Transit) | PCI-DSS 준수 |
| 5️⃣ | 감시 로그 분석 대시보드 (BI) | 의사결정 데이터 화 |

### Phase 4: 규정 확대 (6주)

- ✅ GDPR (EU)
- 🔄 CCPA (California)
- 🔄 LGPD (Brazil)
- 🔄 PIPL (China)
- 🔄 POPIA (South Africa)

---

## 배포 체크리스트

### 사전 작업
- [ ] 데이터베이스 마이그레이션 실행
- [ ] PII 필드 목록 최종 확정 (phone, email, name, bankAccount, idNumber, passport 등)
- [ ] 역할별 권한 정책 검토 (GLOBAL_ADMIN, OWNER, AGENT, ANALYST)
- [ ] 조직별 커스텀 정책 계획

### Phase 1 배포 (즉시)
- [ ] Prisma 모델 + 마이그레이션 실행
- [ ] AuditLogger + PiiAccessControl 라이브러리 배포
- [ ] API 엔드포인트 (monitoring, audit-logs) 배포
- [ ] UI 대시보드 (compliance-monitoring, audit-logs) 배포
- [ ] 감시 로그 기초 테스트

### Phase 2 배포 (1-2주)
- [ ] Admin API 8개 파일에 감시 로그 연결
- [ ] Contact CRUD 감시 추가
- [ ] 데이터 수출 제한 구현
- [ ] 로그인/로그아웃 감시
- [ ] 규정 준수 체크리스트 자동 생성
- [ ] 일일 리포트 Cron 배포

### Phase 3 배포 (2-4주)
- [ ] 고급 이상 탐지 알고리즘
- [ ] GDPR 데이터 요청 API
- [ ] 자동 암호화 (구현 필요 시)

---

## 예상 효과

### 📊 정량적 효과
- **규정 준수율**: 현재 0% → 배포 후 95%+ (GDPR/CCPA 체크리스트 기준)
- **감시 로그 정확도**: 중앙화로 모든 PII 접근 기록 (기존: 부분적)
- **이상 탐지 속도**: 평균 5분 내 자동 감지 (기존: 수동)
- **대응 시간**: 보안 사건 발생 → 관리자 통보 < 1분

### 💰 비용 효율
- **컴플라이언스 심사**: 감시 로그로 자동 증명 → 심사 비용 30% 절감
- **법적 리스크**: PII 무단 접근 방지 → 벌금 회피 (GDPR: 최대 €20M)

### 🔐 보안 강화
- **PII 유출 방지**: RBAC + 대량 수출 제한
- **내부 위협 탐지**: 비정상 IP, 야간 접근, 대량 다운로드 자동 감지
- **감사 추적**: 5년 보관으로 사후 분석 가능

---

## 참고 사항

### 성능 고려사항
- **AuditLog 테이블**: 월 ~500K 행 예상 (월별 파티셔닝으로 성능 유지)
- **인덱싱**: 복합 인덱스 (org + time) + GIN 인덱스 (PII fields)
- **쿼리 응답**: 대부분 < 100ms (최적화된 인덱싱)

### 보안 고려사항
- **PII 마스킹**: 감시 로그에 원본 값 저장 금지 (phone: "010-****-5678")
- **접근 제어**: RBAC 위반 시 즉시 차단 + 감시 로그 기록
- **암호화**: 민감한 필드 저장소 암호화 (구현 필요 시)

### 규정 준수 체크리스트

**GDPR (8개 항목)**:
1. ✅ Data Request Handler (30일 이내 처리)
2. ✅ Right to Delete (GDPR 17조)
3. ✅ Consent Management (GDPR 7조)
4. ✅ Data Processing Agreement (GDPR 28조)
5. ✅ Privacy Impact Assessment (DPIA)
6. ✅ Breach Notification (72시간 이내)
7. ✅ Data Retention Policy (보관 기한 명시)
8. ✅ Audit Trail (감시 로그 유지)

---

## 문의 및 지원

- **기술 문제**: `src/lib/compliance/` 디렉토리 참고
- **정책 문제**: 각 조직의 `ComplianceChecklist` 검토
- **배포 문제**: 데이터베이스 마이그레이션 상태 확인

**마지막 업데이트**: 2026-05-27 | **버전**: 1.0
