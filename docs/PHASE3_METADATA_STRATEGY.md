# Phase 3 메타데이터 보존 전략

## 개요
Phase 3 호환성 하이브리드 설계에서 **subject/body/metadata를 "그냥 두기" 선택**에 따른 상세 전략 및 검증 방법.

## SendingHistory에서 메타데이터 유지

### 저장되는 필드
```typescript
// SendingHistory 스키마
{
  id: string;                    // UUID
  campaignId: string;            // Campaign 참조
  contactId: string;             // Contact 참조
  channel: 'email' | 'sms';      // 발송 채널
  messageId: string;             // 외부 시스템 ID (Sendgrid, Aligo 등)
  
  // ✅ 메타데이터 유지
  subject: string;               // Campaign.title 복사본
  body: string;                  // 렌더링된 메시지 본문
  metadata: Record<string, any>; // JSON (tags, utm 등)
  
  status: 'PENDING' | 'SENT' | 'FAILED';
  sentAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### 메타데이터 예시
```json
{
  "subject": "2026 카리브해 크루즈 특가",
  "metadata": {
    "campaignName": "summer-caribbean-2026",
    "segmentId": "segment_vip_repeat",
    "tags": ["vip", "repeat-customer"],
    "utm_source": "crm-automation",
    "utm_medium": "email",
    "utm_campaign": "caribbean-summer",
    "shipIds": ["ship_001", "ship_002"],
    "departurePortId": "miami"
  }
}
```

## ExecutionLog에서 메타데이터 불포함 (의도적 설계)

### 저장되지 않는 이유
```typescript
// ExecutionLog는 "발송 감시" 목적
// - 발송 성공/실패만 추적
// - 메시지 내용은 불필요
// - 감사 로그 최소화 (스토리지 절감)

// ❌ ExecutionLog (저장 안 함)
subject: undefined,
body: undefined,
metadata: undefined,

// ✅ 필요한 추적 정보만
type: 'SEND_EMAIL' | 'SEND_SMS';
status: 'STARTED' | 'COMPLETED' | 'FAILED';
duration: number; // ms
retries: number;
```

### 감시 목적의 필드
```typescript
interface ExecutionLog {
  id: string;
  campaignId: string;
  contactId: string;
  type: 'SEND_EMAIL' | 'SEND_SMS' | 'QUERY' | 'FILTER';
  
  // 감시 필드
  status: 'STARTED' | 'COMPLETED' | 'FAILED';
  startedAt: Date;
  completedAt: Date | null;
  duration: number; // ms
  retries: number;
  
  // 추적 정보
  sourceName: string; // 크론 job 이름 (e.g., "send-welcome-email")
  contentUrl: string | null; // 향후: S3 저장소 링크
  
  error: string | null;
  metadata: Record<string, any>; // ⚠️ 성능 로깅만 (예: API rate limit 정보)
}
```

## 메타데이터 접근 흐름

### Case 1: 발송 이력 확인 (UI)
```typescript
// 고객 상세 페이지: 받은 이메일 목록
const sendingHistory = await db.sendingHistory.findMany({
  where: { contactId: 'contact_123' },
  orderBy: { createdAt: 'desc' },
  take: 50
});

// ✅ subject, body, metadata 직접 접근 가능
sendingHistory.forEach(history => {
  console.log(history.subject);      // "2026 카리브해 크루즈 특가"
  console.log(history.metadata.tags); // ["vip", "repeat-customer"]
  console.log(history.sentAt);        // 2026-05-18T15:32:00Z
});
```

### Case 2: 발송 성공률 모니터링 (대시보드)
```typescript
// 캠페인 통계: 발송 채널별 성공률
const stats = await db.sendingHistory.groupBy({
  by: ['channel', 'status'],
  where: { campaignId: 'campaign_456' },
  _count: { id: true }
});

// ✅ SendingHistory 상태 필드 활용
// {
//   channel: 'email',
//   status: 'SENT',
//   _count: { id: 245 }
// }

const emailSentCount = stats
  .find(s => s.channel === 'email' && s.status === 'SENT')
  ?._count.id || 0;
```

### Case 3: 실시간 발송 성능 모니터링 (Admin)
```typescript
// 크론 작업 진행 상황
const executionLogs = await db.executionLog.findMany({
  where: { 
    campaignId: 'campaign_456',
    type: 'SEND_EMAIL'
  },
  orderBy: { startedAt: 'desc' },
  take: 100
});

// ✅ ExecutionLog 감시 필드 활용
const avgDuration = executionLogs.reduce((sum, log) => sum + log.duration, 0) 
  / executionLogs.length;
const failureRate = executionLogs.filter(log => log.status === 'FAILED').length 
  / executionLogs.length;

// ❌ subject, body, metadata는 필요 없음
// 감시만 하면 됨
```

## Phase 3 ↔ Phase 4 전환

### Phase 3 (현재, 2026-05-18)
```
SendingHistory
├── subject ✅ (Campaign 제목)
├── body ✅ (렌더링 본문)
└── metadata ✅ (카테고리, 태그, UTM)

ExecutionLog
├── type (SEND_EMAIL, SEND_SMS 등)
├── status (STARTED, COMPLETED, FAILED)
├── duration ✅ (성능 추적)
└── ⚠️ contentUrl = null (아직 미구현)
```

### Phase 4 (계획, TBD)
```
SendingHistory (변경 없음)
├── subject ✅
├── body ✅
└── metadata ✅

ExecutionLog (확장)
├── contentUrl ⭐ (S3 링크, 메시지 본문 아카이브)
├── emailStatus ⭐ (PENDING/SENT/FAILED/BOUNCED)
├── smsStatus ⭐ (PENDING/SENT/FAILED/INVALID)
└── pushStatus ⭐ (PENDING/SENT/FAILED)
```

**contentUrl 추가 이유**:
- SendingHistory.body는 시간 경과에 따라 마이그레이션될 수 있음
- contentUrl은 변경 불가능한 S3 아카이브 (감시 목적)
- ExecutionLog의 감시 기능 완성

## 검증 방법

### 1단계: SendingHistory 저장 검증
```bash
# 실행 후 확인
SELECT COUNT(*) FROM sending_history 
WHERE campaign_id='campaign_123' 
  AND subject IS NOT NULL;

# 기대값: 해당 캠페인 발송 건수와 동일
```

### 2단계: 메타데이터 완전성 검증
```bash
SELECT 
  COUNT(*) AS total,
  COUNT(CASE WHEN metadata IS NOT NULL THEN 1 END) AS has_metadata,
  COUNT(CASE WHEN metadata::text LIKE '%utm%' THEN 1 END) AS with_utm
FROM sending_history 
WHERE created_at > '2026-05-18'::timestamp;
```

### 3단계: ExecutionLog 분리 검증
```bash
# ExecutionLog에는 메타데이터 저장 안 됨
SELECT COUNT(CASE WHEN body IS NOT NULL THEN 1 END) AS non_null_bodies
FROM execution_log 
WHERE type LIKE '%SEND%';

# 기대값: 0
```

## 데이터 일관성 보장

### SendingHistory에 메타데이터 저장 시점
```typescript
// cron job 시작 → Contact 선택 → 메시지 렌더링 → SaveToHistory

async function sendCampaign(campaign: Campaign) {
  const contacts = await selectTargetContacts(campaign);
  
  for (const contact of contacts) {
    const rendered = renderTemplate(campaign.template, contact);
    
    // ✅ 메타데이터 포함하여 저장
    const history = await db.sendingHistory.create({
      data: {
        campaignId: campaign.id,
        contactId: contact.id,
        channel: campaign.channel,
        
        // 메타데이터 저장
        subject: campaign.title,
        body: rendered.html,
        metadata: {
          campaignName: campaign.name,
          tags: campaign.tags,
          utm_source: 'crm-automation',
          utm_campaign: campaign.slug,
          segmentId: contact.segmentId,
        },
        
        status: 'PENDING'
      }
    });
    
    // ExecutionLog에는 저장 안 함
    await db.executionLog.create({
      data: {
        campaignId: campaign.id,
        contactId: contact.id,
        type: 'SEND_EMAIL',
        status: 'STARTED',
        startedAt: new Date(),
        // ❌ subject, body, metadata는 저장 안 함
      }
    });
  }
}
```

## 용어 정의

| 용어 | 정의 | 저장소 | 예시 |
|------|------|--------|------|
| **subject** | 메시지 제목 | SendingHistory | "2026 카리브해 크루즈" |
| **body** | 렌더링된 메시지 본문 | SendingHistory | `<html><body>...</body></html>` |
| **metadata** | JSON 추가 정보 | SendingHistory | `{ tags: [...], utm: {...} }` |
| **sourceName** | 크론 작업 이름 | ExecutionLog | "send-welcome-email" |
| **contentUrl** | S3 아카이브 링크 | ExecutionLog (Phase 4) | `s3://bucket/campaigns/camp_123/msg_456.html` |

## FAQ

### Q: SendingHistory에 body를 저장하면 스토리지가 너무 커지지 않나?
**A**: 
- HTML 이메일: 평균 5-10KB
- 10만 건 발송 = 500MB-1GB (관리 가능)
- 장점: 과거 발송 내용 즉시 조회 가능, S3 저장 비용 절감

### Q: ExecutionLog에 메타데이터가 없으면 나중에 어떻게 문제 추적하나?
**A**:
- ExecutionLog → campaignId, contactId 저장
- 이 두 정보로 SendingHistory 조회 가능
- SendingHistory에서 subject, body, metadata 확인

### Q: Phase 4에서 emailStatus/smsStatus 분리하면 API 호환성 깨지지 않나?
**A**:
- 신규 필드 추가만 해서 기존 status 필드는 유지
- 기존 쿼리: `WHERE status='SENT'` → 그대로 작동
- 신규 기능: `WHERE emailStatus='BOUNCED'` → 추가 로직

## 마이그레이션 스크립트 (Phase 4 준비)

```sql
-- 선택사항: Phase 4를 위한 사전 스키마 확인
-- (실제 마이그레이션은 Phase 4에서 진행)

-- ExecutionLog에 contentUrl 추가
-- ALTER TABLE execution_log ADD COLUMN content_url TEXT;

-- SendingHistory 메타데이터 형식 검증
SELECT 
  id,
  metadata::text as metadata_json,
  char_length(body) as body_size_bytes
FROM sending_history 
LIMIT 10;
```

## 결론

✅ **Phase 3: 메타데이터는 SendingHistory에만 저장**
- 발송 이력 조회: SendingHistory 활용
- 실시간 감시: ExecutionLog 활용 (메타데이터 불필요)

✅ **Phase 4: ExecutionLog 확장 (향후)**
- contentUrl 추가 (S3 아카이브)
- emailStatus, smsStatus 분리 (멀티채널 대비)

**핵심**: 각 테이블이 명확한 역할 분담 → 성능 최적화 + 유지보수 용이
