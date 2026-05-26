# 규정 준수 감시 시스템 구현 체크리스트

**프로젝트**: 마비즈 CRM 규정 준수 & 감시 시스템  
**시작일**: 2026-05-27  
**완료목표**: 2026-06-10 (Phase 2)  

---

## ✅ Phase 1: 기초 인프라 (2026-05-27 완료)

### 데이터베이스
- [x] Prisma 스키마 업데이트 (7개 모델 추가)
  - [x] `AuditLog` — 중앙 감시 로그
  - [x] `PiiAccessPolicy` — PII 접근 정책
  - [x] `AnomalyDetection` — 이상 활동 기록
  - [x] `ComplianceRule` — 이상 탐지 규칙
  - [x] `ComplianceChecklist` — 규정 준수 체크리스트
  - [x] `BackupAuditTrail` — 백업 증명
  - [x] `DataAccessRequest` — GDPR 데이터 요청
- [x] SQL 마이그레이션 스크립트 작성 (인덱싱, 파티셔닝 포함)

### 핵심 라이브러리
- [x] `AuditLogger` 클래스 구현
  - [x] `record()` — PII 접근 로그 기록
  - [x] `queryLogs()` — 필터링된 로그 조회
  - [x] `checkPiiBulkAccess()` — 대량 접근 탐지
  - [x] `checkFailedLoginAttempts()` — 실패 로그인 감지
  - [x] `checkUnusualAccessTime()` — 야간 접근 감지
  - [x] `recordAnomaly()` — 이상 활동 기록
  - [x] `generateDailyReport()` — 일일 리포트
- [x] `PiiAccessControl` 클래스 구현
  - [x] `canAccessField()` — 단일 필드 권한 확인
  - [x] `filterAccessibleFields()` — 다중 필드 필터링
  - [x] `checkBulkExportLimit()` — 수출 제한 검사
  - [x] `checkQueryResultLimit()` — 쿼리 크기 제한
  - [x] `maskPiiValue()` — PII 값 마스킹
  - [x] `getDefaultPolicy()` — 기본 권한 정책

### API 엔드포인트
- [x] `GET /api/admin/compliance/monitoring` — 실시간 대시보드
  - [x] 일일 활동 요약 (4개 카드)
  - [x] 최근 이상 활동 (Top 20)
  - [x] PII 접근 상위 사용자 (Top 5)
  - [x] 규정 준수 상태 (GDPR/CCPA)
  - [x] 위험도 점수 계산 (0-100)
  - [x] 감시 로그 기록

- [x] `GET /api/admin/compliance/audit-logs` — 로그 조회
  - [x] 필터링 (userId, action, status, 날짜)
  - [x] 페이지네이션 (limit/offset)
  - [x] 정렬 (최신순)
  - [x] 조회 감시 로그 기록

### UI 대시보드
- [x] `/admin/compliance-monitoring` 페이지
  - [x] 위험도 점수 카드 (큰 숫자 + 수준 표시)
  - [x] 4개 요약 카드 (활동, PII 접근, 의심, 실패)
  - [x] 위험 요소 분석 (4개 막대 차트)
  - [x] 최근 이상 활동 리스트
  - [x] 규정 준수 체크리스트 (2개 regulation)
  - [x] 상위 PII 접근자 (Top 5 테이블)
  - [x] 5분 자동 새로고침

- [x] `/admin/audit-logs` 페이지
  - [x] 고급 필터 패널 (6개 필터)
  - [x] 감시 로그 테이블 (8개 컬럼)
  - [x] 페이지네이션
  - [x] 상세보기 모달
  - [x] 색상 코드 (액션별, 상태별)

### 문서화
- [x] `docs/COMPLIANCE_MONITORING_ARCHITECTURE.md`
  - [x] 시스템 개요
  - [x] 현재 상태 분석
  - [x] 인프라 설계 (상세)
  - [x] 즉시 연결 작업 (Phase 2)
  - [x] 중장기 로드맵
  - [x] 배포 체크리스트
  - [x] 예상 효과

---

## 🔄 Phase 2: Admin/Analytics 연결 (진행 중, 2026-05-28 ~ 06-03)

### Admin API 감시 로그 추가 (8개 파일)

#### 1. Organizations API
**파일**: `src/app/api/admin/organizations/route.ts`
- [ ] `GET /api/admin/organizations` 에서:
  - [ ] 조직 읽기 감시 로그 추가
  - [ ] PII 필드 (멤버 email, phone) 검사
  - [ ] 대량 조회 시 `checkQueryResultLimit()` 검사

**구현 코드**:
```typescript
// 함수 끝에 추가
await auditLogger.record({
  organizationId: ctx.organizationId,
  userId: ctx.userId,
  action: 'READ',
  resourceType: 'Organization',
  piiFieldsAccessed: ['email', 'phone'],  // owner member 정보
  purpose: 'Business',
  durationMs: Date.now() - startTime,
});
```

#### 2. Affiliate Managers API
**파일**: `src/app/api/admin/affiliate-managers/route.ts`
**파일**: `src/app/api/admin/affiliate-managers/[memberId]/route.ts`
- [ ] 멤버 정보 조회 시 감시 로그 추가
- [ ] `phone`, `email` 필드 PII 접근 기록
- [ ] 멤버 상세 조회 시 PII 필드 필터링

#### 3. Affiliate Sales API
**파일**: `src/app/api/admin/affiliate-sales/route.ts`
- [ ] 판매 데이터 조회 감시
- [ ] 연락처 정보 포함 시 감시

#### 4. Groups Stats API
**파일**: `src/app/api/admin/groups-stats/route.ts`
- [ ] 그룹 통계 조회 감시

#### 5. Partner Applications API
**파일**: `src/app/api/admin/partner-applications/route.ts`
- [ ] 파트너 신청 데이터 조회 감시
- [ ] 연락처 정보 PII 기록

#### 6. Sending Monitor API
**파일**: `src/app/api/admin/sending-monitor/route.ts`
- [ ] SMS/이메일 발송 현황 조회 감시

#### 7. Backup Status API
**파일**: `src/app/api/admin/backup-status/route.ts`
- [ ] 백업 상태 조회 감시
- [ ] `BackupAuditTrail` 테이블 연동

#### 8. Additional Admin APIs
**파일**: `src/app/api/admin/*/route.ts` (기타 모든 관리자 API)
- [ ] 동일한 감시 로그 추가

### Contact API 감시 로그 추가 (CRUD)

#### 1. Contact 읽기 API
**파일**: `src/app/api/contacts/route.ts` 또는 `[id]/route.ts`
```typescript
// GET 요청 시
await auditLogger.record({
  organizationId: ctx.organizationId,
  userId: ctx.userId,
  action: 'READ',
  resourceType: 'Contact',
  resourceId: contactId,
  piiFieldsAccessed: ['phone', 'email', 'name'],
});
```

- [ ] Contact 목록 조회 감시
- [ ] 대량 조회 시 `checkQueryResultLimit()` 검사
- [ ] 필터링된 필드만 기록

#### 2. Contact 수정 API
**파일**: `src/app/api/contacts/[id]/route.ts`
```typescript
// PUT/PATCH 요청 시
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
```

- [ ] 필드 변경 전/후 값 기록
- [ ] 마스킹된 값으로 저장

#### 3. Contact 삭제 API
```typescript
// DELETE 요청 시
await auditLogger.record({
  organizationId: ctx.organizationId,
  userId: ctx.userId,
  action: 'DELETE',
  resourceType: 'Contact',
  resourceId: contactId,
  piiFieldsAccessed: ['phone', 'email', 'name'],
  purpose: 'Compliance',
});
```

- [ ] Contact 삭제 감시

#### 4. Contact 벌크 작업 API
**파일**: `src/app/api/contacts/bulk-*` 또는 유사 API
```typescript
// 벌크 작업 시
const bulkCheck = await piiAccessControl.checkBulkExportLimit(
  ctx.role,
  contactIds.length,
  ctx.organizationId
);

if (!bulkCheck.allowed) {
  return NextResponse.json(
    { ok: false, error: bulkCheck.reason },
    { status: 403 }
  );
}

await auditLogger.record({
  organizationId: ctx.organizationId,
  userId: ctx.userId,
  action: 'DELETE' // 또는 'EXPORT'
  resourceType: 'Contact',
  piiFieldsAccessed: ['phone', 'email', 'name'],
});
```

- [ ] 대량 삭제 시 제한 검사
- [ ] 벌크 작업 감시

### 데이터 수출 API 제한 추가

#### 1. Excel/CSV 수출 API
**파일**: `src/app/api/admin/apis/excel/route.ts` 또는 유사 API
```typescript
// 수출 전 검사
const bulkCheck = await piiAccessControl.checkBulkExportLimit(
  ctx.role,
  contacts.length,
  ctx.organizationId
);

if (!bulkCheck.allowed) {
  return NextResponse.json({ error: bulkCheck.reason }, { status: 403 });
}

// 수출 후 감시
await auditLogger.record({
  organizationId: ctx.organizationId,
  userId: ctx.userId,
  action: 'EXPORT',
  resourceType: 'Contact',
  piiFieldsAccessed: ['phone', 'email', 'name'],
  purpose: 'Business',
});
```

- [ ] 수출 행 수 제한 (역할별)
- [ ] AGENT: 최대 100행
- [ ] OWNER: 최대 1,000행
- [ ] GLOBAL_ADMIN: 최대 100,000행

#### 2. SMS/Email 대량 발송 API
**파일**: `src/app/api/sms/*` 또는 `src/app/api/email/*`
- [ ] 발송 대상 수 제한 (역할별)
- [ ] 발송 감시 로그 기록

### Admin UI PII 필터링 추가

#### 1. Organizations 페이지
**파일**: `src/app/(dashboard)/admin/organizations/page.tsx`
```typescript
// AGENT 역할에서 phone, email 숨기기
const canSeeEmail = await piiAccessControl.canAccessField(
  ctx.role,
  'email',
  'read',
  ctx.organizationId
);

return (
  <table>
    {/* canSeeEmail이면 email 컬럼 표시 */}
  </table>
);
```

- [ ] 역할별로 민감한 필드 숨기기
- [ ] 마스킹된 값 표시 (phone: "010-****-5678")

#### 2. Partner Applications 페이지
**파일**: `src/app/(dashboard)/admin/partner-applications/page.tsx`
- [ ] 신청자 연락처 PII 필터링

#### 3. Sending Monitor 페이지
**파일**: `src/app/(dashboard)/admin/sending-monitor/page.tsx`
- [ ] 발송 수신자 정보 필터링

### 인증 시스템 감시 추가

#### 1. Login API
**파일**: `src/lib/auth.ts` 또는 인증 라우트
```typescript
// 로그인 시도
await auditLogger.record({
  userId: email,
  action: 'LOGIN',
  resourceType: 'Session',
  status: 'SUCCESS',  // 또는 'FAILED'
  ipAddress: req.ip,
});

// 실패한 로그인 검사
const failedAttempts = await auditLogger.checkFailedLoginAttempts(
  email,
  60  // 1시간
);

if (failedAttempts >= 5) {
  // 계정 잠금 또는 추가 인증 필요
  return NextResponse.json(
    { error: '로그인 시도 실패가 많습니다. 나중에 다시 시도하세요.' },
    { status: 429 }
  );
}
```

- [ ] 로그인 성공/실패 감시
- [ ] 실패 횟수 집계
- [ ] 5회 실패 시 계정 보호 (옵션)

#### 2. Logout API
**파일**: `src/lib/auth.ts` 또는 인증 라우트
```typescript
await auditLogger.record({
  userId: ctx.userId,
  action: 'LOGOUT',
  resourceType: 'Session',
  status: 'SUCCESS',
});
```

- [ ] 로그아웃 감시

### 규정 준수 체크리스트 자동 생성

#### 1. 신규 조직 생성 시
**파일**: `src/app/api/organizations/route.ts` 또는 `src/lib/organization.ts`
```typescript
// 신규 조직 생성 후
await prisma.complianceChecklist.create({
  data: {
    organizationId: newOrg.id,
    regulationType: 'GDPR',
    items: {
      items: [
        { id: 'gdpr_1', name: 'Data Request Handler (30일 처리)', completed: false },
        { id: 'gdpr_2', name: 'Right to Delete (GDPR 17조)', completed: false },
        { id: 'gdpr_3', name: 'Consent Management (GDPR 7조)', completed: false },
        // ... (8개 항목)
      ]
    },
    completionRate: 0,
  },
});

await prisma.complianceChecklist.create({
  data: {
    organizationId: newOrg.id,
    regulationType: 'CCPA',
    items: { items: [...] },  // California Privacy Act 항목
    completionRate: 0,
  },
});
```

- [ ] GDPR 체크리스트 자동 생성 (8개 항목)
- [ ] CCPA 체크리스트 자동 생성 (6개 항목)
- [ ] 기본값: 0% 완료율

### 일일 규정 준수 리포트 Cron 작업

#### 1. Cron 함수 작성
**파일**: `src/lib/cron/daily-compliance-report.ts`
```typescript
export async function generateDailyComplianceReport() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true },
  });

  for (const org of orgs) {
    const report = await auditLogger.generateDailyReport(org.id);
    
    // Slack 알림 (조직별 #compliance 채널)
    if (report.suspiciousActivities > 0) {
      await notifySlack({
        channel: `#compliance-${org.id}`,
        text: `[${org.name}] 규정 준수 일일 리포트\n의심 활동: ${report.suspiciousActivities}건\n...`,
      });
    }
  }
}
```

#### 2. Cron 스케줄 등록
**파일**: `src/lib/cron/index.ts` 또는 작업 스케줄러
```typescript
// 매일 9AM UTC (한국 6PM) 실행
schedule('0 9 * * *', generateDailyComplianceReport);
```

- [ ] Cron 함수 작성
- [ ] 매일 9AM UTC 스케줄 등록
- [ ] Slack 알림 통합
- [ ] 테스트 (수동 실행)

---

## 🔴 Phase 3: 고급 기능 (예정, 2026-06-04 ~ 06-10)

### Analytics 대시보드 확장
- [ ] 새 페이지: `/admin/analytics/compliance`
  - [ ] 시간별 PII 접근 차트
  - [ ] 사용자별 액션 분포
  - [ ] 상위 위험 활동
  - [ ] 주간 규정 준수율

### Year-End Report 확장
- [ ] 규정 준수 섹션 추가:
  - [ ] GDPR 준수율
  - [ ] 데이터 요청 처리 현황
  - [ ] 보안 사건 기록
  - [ ] 백업 검증 현황

### Documents 페이지 감시
- [ ] 문서 다운로드 감시 로그 추가
- [ ] 개인 문서 접근 기록

### 고급 이상 탐지
- [ ] ML 기반 이상 탐지 (Isolation Forest) — 선택사항
- [ ] 야간 접근 자동 차단 (옵션)
- [ ] IP 화이트리스트/블랙리스트

---

## 🎯 각 Phase별 담당자 & 마감일

| Phase | 담당 | 시작 | 마감 | 상태 |
|-------|------|------|------|------|
| **Phase 1** | Compliance Agent | 2026-05-27 | 2026-05-27 | ✅ 완료 |
| **Phase 2** | Dev Team | 2026-05-28 | 2026-06-03 | 🔄 진행 중 |
| **Phase 3** | Dev Team | 2026-06-04 | 2026-06-10 | ⏳ 예정 |
| **Testing** | QA Team | 2026-06-08 | 2026-06-10 | ⏳ 예정 |
| **Production** | DevOps | 2026-06-11 | 2026-06-11 | ⏳ 예정 |

---

## ✅ 체크리스트 사용 방법

1. **각 작업 옆의 `[ ]`를 클릭하여 완료 표시**
2. **완료 일시와 담당자 기록** (옵션):
   - `[x] 작업명 — 2026-05-28 18:00 by @dev-name`
3. **Progress 업데이트**:
   - Phase 2 진행도 = (완료 항목 / 전체 항목) × 100%

---

## 연락처 & 문의

- **기술 질문**: `docs/COMPLIANCE_MONITORING_ARCHITECTURE.md` 참고
- **구현 지원**: `src/lib/compliance/audit-logger.ts`, `src/lib/compliance/pii-access-control.ts`
- **배포 지원**: `COMPLIANCE_MONITORING_ARCHITECTURE.md#배포-체크리스트`

**마지막 업데이트**: 2026-05-27 14:30 UTC  
**버전**: 1.0
