# Menu #38 Phase 3 Enum 매핑 가이드

**작성일**: 2026-05-18  
**대상**: 개발자  
**우선순위**: P1 (클라이언트 응답 정확성)

---

## 1. Enum 정의 비교

### 1.1 Status Enum (완전 호환)

```typescript
// SendingHistory에서 사용
enum SendingStatus {
  PENDING            // 발송 대기
  SENT               // 발송 성공
  FAILED             // 발송 실패
  SKIPPED            // 건너뜀 (조건 미충족)
  RETRY_SCHEDULED    // 재시도 예정
  ABANDONED          // 최대 재시도 초과
}

// ExecutionLog에서 사용
enum ExecutionStatus {
  PENDING            // 발송 대기
  SENT               // 발송 성공
  FAILED             // 발송 실패
  SKIPPED            // 건너뜀 (조건 미충족)
  RETRY_SCHEDULED    // 재시도 예정
  ABANDONED          // 최대 재시도 초과
}

// 매핑: 1:1 동일 ✅
SendingStatus.SENT === ExecutionStatus.SENT
```

**호환성**: **100%** (변환 불필요)

---

### 1.2 Failure Reason Enum (불완전 호환)

#### SendingFailureReason (Phase 2 - 캠페인 중심)
```prisma
enum SendingFailureReason {
  INVALID_EMAIL      // 유효하지 않은 이메일 형식
  INVALID_PHONE      // 유효하지 않은 휴대폰 번호
  OPT_OUT            // 수신거부 고객
  QUOTA_EXCEEDED     // 일일/월간 발송 한도 초과
  SYSTEM_ERROR       // CRM 내부 오류
  PROVIDER_ERROR     // SMS/Email 서비스 오류 (Aligo, SMTP 등)
  NETWORK_ERROR      // 네트워크 오류
  BOUNCE             // 이메일 반송
}
```

**8개 값**

#### ExecutionFailureReason (Phase 0+2 - 통합)
```prisma
enum ExecutionFailureReason {
  INVALID_EMAIL      // 유효하지 않은 이메일 형식
  INVALID_PHONE      // 유효하지 않은 휴대폰 번호
  INVALID_CONTACT    // 기타 유효하지 않은 연락처 (자동화 규칙용)
  OPT_OUT            // 수신거부 고객
  QUOTA_EXCEEDED     // 일일/월간 발송 한도 초과
  SYSTEM_ERROR       // CRM 내부 오류
  PROVIDER_ERROR     // SMS/Email 서비스 오류
  NETWORK_ERROR      // 네트워크 오류
  BOUNCE             // 이메일 반송
}
```

**9개 값** (INVALID_CONTACT 추가)

---

## 2. 매핑 테이블

### 2.1 Forward (ExecutionLog → SendingHistory)

**언제 사용**: ExecutionLog 데이터를 SendingHistory API로 반환할 때

```typescript
const executionFailureReasonToSendingFailureReason = {
  // 직접 매핑 (1:1)
  'INVALID_EMAIL': 'INVALID_EMAIL',
  'INVALID_PHONE': 'INVALID_PHONE',
  'OPT_OUT': 'OPT_OUT',
  'QUOTA_EXCEEDED': 'QUOTA_EXCEEDED',
  'SYSTEM_ERROR': 'SYSTEM_ERROR',
  'PROVIDER_ERROR': 'PROVIDER_ERROR',
  'NETWORK_ERROR': 'NETWORK_ERROR',
  'BOUNCE': 'BOUNCE',
  
  // 비직접 매핑 (정보 손실 ⚠️)
  'INVALID_CONTACT': 'INVALID_PHONE',  // 자동화/퍼널용 → 전화번호로 가정
};

// 역 매핑 함수
function mapExecutionToSendingFailureReason(reason) {
  if (!reason) return null;
  const mapped = executionFailureReasonToSendingFailureReason[reason];
  
  if (!mapped) {
    logger.warn('[Enum Mapping] Unknown ExecutionFailureReason', { reason });
    return 'SYSTEM_ERROR';  // 안전 기본값
  }
  
  // INVALID_CONTACT 매핑 시 경고 로그
  if (reason === 'INVALID_CONTACT') {
    logger.warn('[Enum Mapping] INVALID_CONTACT mapped to INVALID_PHONE', {
      reason,
      mapped,
      note: '정보 손실 가능성 있음'
    });
  }
  
  return mapped;
}
```

**호환성**: **95%** (INVALID_CONTACT 손실 가능)

---

### 2.2 Backward (SendingHistory → ExecutionLog)

**언제 사용**: SendingHistory 데이터를 ExecutionLog로 마이그레이션할 때

```typescript
const sendingFailureReasonToExecutionFailureReason = {
  // 직접 매핑 (1:1)
  'INVALID_EMAIL': 'INVALID_EMAIL',
  'INVALID_PHONE': 'INVALID_PHONE',
  'OPT_OUT': 'OPT_OUT',
  'QUOTA_EXCEEDED': 'QUOTA_EXCEEDED',
  'SYSTEM_ERROR': 'SYSTEM_ERROR',
  'PROVIDER_ERROR': 'PROVIDER_ERROR',
  'NETWORK_ERROR': 'NETWORK_ERROR',
  'BOUNCE': 'BOUNCE',
};

function mapSendingToExecutionFailureReason(reason) {
  if (!reason) return null;
  const mapped = sendingFailureReasonToExecutionFailureReason[reason];
  
  if (!mapped) {
    logger.warn('[Enum Mapping] Unknown SendingFailureReason', { reason });
    return 'SYSTEM_ERROR';
  }
  
  return mapped;
}
```

**호환성**: **100%** (SendingFailureReason은 모두 매핑 가능)

---

## 3. 구현 전략

### 3.1 Phase 3a: 하이브리드 (SendingHistory API 유지)

**목표**: SendingHistory API 응답 100% 호환성 유지

```typescript
// src/app/api/campaigns/sending-history/route.ts
import { 
  mapExecutionToSendingFailureReason 
} from '@/lib/enum-mapping';

export async function GET(req: Request) {
  // ... 기존 코드
  
  // Feature flag 활성화 시 ExecutionLog 사용 (테스트용)
  if (process.env.USE_EXECUTION_LOG_FOR_SENDING_HISTORY === 'true') {
    const histories = await prisma.executionLog.findMany({
      where: {
        organizationId: orgId,
        sourceType: 'CAMPAIGN',  // 캠페인만 필터링
        ...(filterStatus && { status: filterStatus }),
      },
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true } },
        campaign: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    
    // ExecutionLog → SendingHistory 응답 포맷 변환
    const serialized = histories.map((log) => ({
      id: log.id,
      contact: log.contact,
      campaign: log.campaign,
      channel: log.channel,
      status: log.status,
      sentAt: log.sentAt,
      failureReason: mapExecutionToSendingFailureReason(log.failureReason),
      failureUserMsg: log.failureUserMsg,
      retryCount: log.retryCount,
      maxRetries: log.maxRetries,
      createdAt: log.createdAt,
      // ⚠️ 의도적 생략 (SendingHistory도 응답에 미포함):
      // - subject, body (→ contentUrl로만 제공 가능)
      // - metadata (→ null, 이미 응답에 없음)
      // - emailStatus, smsStatus (→ 불필요)
    }));
    
    return NextResponse.json({
      ok: true,
      histories: serialized,
      total,
      limit,
      offset,
    });
  }
  
  // 기존 SendingHistory 사용 (기본값)
  // ... 기존 코드
}
```

**특징**:
- ✅ 응답 포맷 100% 동일
- ✅ Feature flag로 언제든 복구 가능
- ⚠️ Contact 조인으로 인한 성능 저하 (N+1)
- ⚠️ 과거 contact 정보 손실 (현재 name 반환)

---

### 3.2 Phase 3b: 완전 마이그레이션 (ExecutionLog 단독)

**목표**: ExecutionLog API로 전환

```typescript
// src/app/api/campaigns/execution-logs/route.ts (새로운 엔드포인트)
import { 
  mapExecutionToSendingFailureReason 
} from '@/lib/enum-mapping';

/**
 * GET /api/campaigns/execution-logs
 * 캠페인 발송 로그 조회 (ExecutionLog 기반)
 * 
 * ⚠️ Phase 3b에서만 사용 (SendingHistory 제거 후)
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    
    const url = new URL(req.url);
    const status = url.searchParams.get('status')?.toUpperCase();
    const sourceType = url.searchParams.get('sourceType')?.toUpperCase();  // NEW
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);
    
    const where = {
      organizationId: orgId,
      // Phase 3b: 캠페인만 필터링 가능
      sourceType: sourceType || 'CAMPAIGN',
      ...(status && { status }),
    };
    
    const [logs, total] = await Promise.all([
      prisma.executionLog.findMany({
        where,
        include: {
          contact: {
            select: { id: true, name: true, phone: true, email: true }
          },
          campaign: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.executionLog.count({ where }),
    ]);
    
    // ExecutionLog → 응답 포맷 (SendingHistory와 다름 ⚠️)
    const serialized = logs.map((log) => ({
      id: log.id,
      sourceType: log.sourceType,  // NEW (CAMPAIGN | FUNNEL_SEQUENCE | AUTOMATION_RULE)
      sourceName: log.sourceName,  // NEW (규칙/시퀀스/캠페인명)
      contact: log.contact,
      campaign: log.campaign,
      channel: log.channel,
      status: log.status,
      sentAt: log.sentAt,
      failureReason: mapExecutionToSendingFailureReason(log.failureReason),
      failureUserMsg: log.failureUserMsg,
      retryCount: log.retryCount,
      maxRetries: log.maxRetries,
      createdAt: log.createdAt,
      executeMonth: log.executeMonth,  // NEW (월별 반복)
      
      // Phase 3b에서 신규 추가 (SendingHistory와 다름)
      ...(log.contentUrl && { contentUrl: log.contentUrl }),
      ...(log.emailOpenedAt && { emailOpenedAt: log.emailOpenedAt }),
      ...(log.linkClickedAt && { linkClickedAt: log.linkClickedAt }),
    }));
    
    return NextResponse.json({
      ok: true,
      logs: serialized,  // 필드명 변경
      total,
      limit,
      offset,
    });
  } catch (err) {
    logger.error('[GET /api/campaigns/execution-logs]', { err });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

**변경 사항**:
- 엔드포인트 변경: `/sending-history` → `/execution-logs`
- 응답 필드명 변경: `histories` → `logs`
- 신규 필드: `sourceType`, `sourceName`, `executeMonth`, `contentUrl`
- 제거 필드: `metadata`, `emailStatus`, `smsStatus`

**호환성**: **95%** (엔드포인트 변경, 필드 손실)

---

## 4. 테스트 케이스

### 4.1 Enum 매핑 테스트

```typescript
describe('Enum Mapping', () => {
  describe('mapExecutionToSendingFailureReason', () => {
    it('should map INVALID_EMAIL', () => {
      expect(mapExecutionToSendingFailureReason('INVALID_EMAIL'))
        .toBe('INVALID_EMAIL');
    });
    
    it('should map INVALID_CONTACT to INVALID_PHONE', () => {
      expect(mapExecutionToSendingFailureReason('INVALID_CONTACT'))
        .toBe('INVALID_PHONE');
    });
    
    it('should return null for null input', () => {
      expect(mapExecutionToSendingFailureReason(null))
        .toBe(null);
    });
    
    it('should return SYSTEM_ERROR for unknown reason', () => {
      expect(mapExecutionToSendingFailureReason('UNKNOWN_REASON'))
        .toBe('SYSTEM_ERROR');
    });
    
    it('should log warning for INVALID_CONTACT', () => {
      const logSpy = jest.spyOn(logger, 'warn');
      mapExecutionToSendingFailureReason('INVALID_CONTACT');
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('INVALID_CONTACT mapped')
      );
    });
  });
});
```

---

### 4.2 API 응답 호환성 테스트

```typescript
describe('Phase 3a: SendingHistory API with ExecutionLog backend', () => {
  beforeAll(() => {
    process.env.USE_EXECUTION_LOG_FOR_SENDING_HISTORY = 'true';
  });
  
  it('should return compatible SendingHistory format', async () => {
    const res = await GET(mockRequest);
    const body = JSON.parse(res.body);
    
    // 응답 구조 검증
    expect(body).toHaveProperty('ok', true);
    expect(body).toHaveProperty('histories');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('limit');
    expect(body).toHaveProperty('offset');
    
    // 각 히스토리 필드 검증
    const history = body.histories[0];
    expect(history).toHaveProperty('id');
    expect(history).toHaveProperty('contact.id');
    expect(history).toHaveProperty('campaign.id');
    expect(history).toHaveProperty('status');
    expect(history).toHaveProperty('sentAt');
    expect(history).toHaveProperty('failureReason');  // ⚠️ null 가능
    expect(history).toHaveProperty('createdAt');
  });
  
  it('should not have metadata field', async () => {
    const res = await GET(mockRequest);
    const body = JSON.parse(res.body);
    const history = body.histories[0];
    
    expect(history).not.toHaveProperty('metadata');
  });
  
  it('should not have subject, body fields', async () => {
    const res = await GET(mockRequest);
    const body = JSON.parse(res.body);
    const history = body.histories[0];
    
    expect(history).not.toHaveProperty('subject');
    expect(history).not.toHaveProperty('body');
  });
});
```

---

## 5. 마이그레이션 쿼리

### 5.1 ExecutionLog 초기 데이터 로드

```sql
-- SendingHistory → ExecutionLog 데이터 마이그레이션
-- (Phase 3a 중 데이터 검증용)

INSERT INTO "ExecutionLog" (
  id, 
  "organizationId",
  "sourceType",
  "sourceId",
  "sourceName",
  "campaignId",
  "contactId",
  email,
  phone,
  channel,
  status,
  "executeMonth",
  "scheduledAt",
  "sentAt",
  "contentUrl",
  "messageId",
  "failureReason",
  "failureUserMsg",
  "retryCount",
  "maxRetries",
  "emailOpenedAt",
  "linkClickedAt",
  "registeredAt",
  "landingPageViewId",
  "createdAt",
  "updatedAt"
)
SELECT
  sh.id,
  sh."organizationId",
  'CAMPAIGN' as "sourceType",
  COALESCE(sh."campaignId", sh."sourceId") as "sourceId",
  c.title as "sourceName",
  sh."campaignId",
  sh."contactId",
  sh.email,
  sh.phone,
  sh.channel,
  sh.status,
  TO_CHAR(sh."createdAt", 'YYYY-MM') as "executeMonth",
  sh."scheduledAt",
  sh."sentAt",
  NULL as "contentUrl",  -- S3 URL 추후 업로드
  sh."messageId",
  sh."failureReason",
  sh."failureUserMsg",
  sh."retryCount",
  sh."maxRetries",
  sh."emailOpenedAt",
  sh."linkClickedAt",
  sh."registeredAt",
  sh."landingPageViewId",
  sh."createdAt",
  sh."updatedAt"
FROM "SendingHistory" sh
LEFT JOIN "CrmMarketingCampaign" c ON sh."campaignId" = c.id
WHERE sh."sendingType" = 'CAMPAIGN'
ON CONFLICT (id) DO NOTHING;
```

---

### 5.2 데이터 검증 쿼리

```sql
-- Phase 3a: SendingHistory vs ExecutionLog 데이터 정합성 검증

SELECT
  'SendingHistory' as source,
  COUNT(*) as count,
  COUNT(CASE WHEN status = 'SENT' THEN 1 END) as sent,
  COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed,
  COUNT(CASE WHEN "failureReason" IS NOT NULL THEN 1 END) as with_failure_reason
FROM "SendingHistory"
WHERE "sendingType" = 'CAMPAIGN'
AND "createdAt" > NOW() - INTERVAL '7 days'

UNION ALL

SELECT
  'ExecutionLog' as source,
  COUNT(*) as count,
  COUNT(CASE WHEN status = 'SENT' THEN 1 END) as sent,
  COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed,
  COUNT(CASE WHEN "failureReason" IS NOT NULL THEN 1 END) as with_failure_reason
FROM "ExecutionLog"
WHERE "sourceType" = 'CAMPAIGN'
AND "createdAt" > NOW() - INTERVAL '7 days';
```

---

## 6. 문제 해결 가이드

### 문제: INVALID_CONTACT 매핑으로 인한 혼동

**증상**: 클라이언트가 "휴대폰 오류"라고 표시하지만 실제로는 "기타 연락처 오류"

**해결책**:
```typescript
// Option A: 매핑 시 주석 추가
function mapExecutionToSendingFailureReason(reason) {
  if (reason === 'INVALID_CONTACT') {
    return {
      mapped: 'INVALID_PHONE',
      originalReason: 'INVALID_CONTACT',
      note: '자동화 규칙에서 유효하지 않은 연락처 (이메일 또는 휴대폰)',
    };
  }
  // ...
}

// Option B: SendingHistory API에 executionFailureReason 필드 추가
{
  failureReason: 'INVALID_PHONE',          // 매핑된 값
  executionFailureReason: 'INVALID_CONTACT', // 원본 값
}

// Option C: 경고 배지 추가
{
  failureReason: 'INVALID_PHONE',
  failureUserMsg: '[자동화] 유효하지 않은 연락처 (이메일 또는 휴대폰)',
}
```

**권장**: **Option C** (사용자 메시지 명확화)

---

### 문제: Contact 정보 과거 데이터 손실

**증상**: 과거 로그에서 contact.name이 현재 값으로 표시됨

**해결책**:
```typescript
// Option A: 조인 생략 (contact 정보 제거)
const serialized = logs.map((log) => ({
  // ... 기타 필드
  contactId: log.contactId,  // ID만 제공
  // contact 필드 제거
}));

// Option B: ExecutionLog에 contactName 추가
// Prisma migration 필요
// ExecutionLog.contactName String?

// Option C: 별도 API 제공
// GET /api/contacts/:contactId/history
```

**권장**: **Option A** (간단, 성능 개선)

---

## 7. 롤백 절차

### 즉시 롤백 (< 5분)

```typescript
// Feature flag 비활성화
process.env.USE_EXECUTION_LOG_FOR_SENDING_HISTORY = 'false';

// SendingHistory API로 자동 복구
// (기존 코드 실행)
```

### 완전 롤백 (데이터 검증)

```typescript
// 1. ExecutionLog 데이터 백업
pg_dump -U postgres mabiz_crm > executionlog_backup.sql

// 2. ExecutionLog 전체 삭제 (필요시)
TRUNCATE TABLE "ExecutionLog";

// 3. SendingHistory 데이터 무결성 검증
SELECT COUNT(*) FROM "SendingHistory"
WHERE "sendingType" = 'CAMPAIGN'
AND "createdAt" > NOW() - INTERVAL '1 day';
```

---

## 참고: Enum 값 업데이트 시 주의사항

### 새로운 Enum 값 추가 시

```typescript
// ❌ 위험한 방식 (기존 매핑 깨짐)
enum ExecutionFailureReason {
  // ... 기존 8개
  INVALID_CONTACT
  NEW_ERROR_TYPE  // ← 추가 시 매핑 테이블 업데이트 필수!
}

// ✅ 안전한 방식 (매핑 테이블 함께 업데이트)
const executionFailureReasonToSendingFailureReason = {
  // ... 기존 매핑
  'NEW_ERROR_TYPE': 'SYSTEM_ERROR',  // ← 새로운 매핑 추가
};
```

---

