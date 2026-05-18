# Phase 3 채널 상태 관리 전략

## 개요
Phase 3 호환성 하이브리드 설계에서 **emailStatus/smsStatus 분리하지 않기** 결정에 따른 상세 전략.

## Phase 3: 단순화 설계 (현재)

### SendingHistory 상태 필드 (단일 필드)
```typescript
interface SendingHistory {
  id: string;
  campaignId: string;
  contactId: string;
  channel: 'email' | 'sms'; // 채널은 분리, 상태는 통합
  
  // ✅ 단일 상태 필드
  status: 'PENDING' | 'SENT' | 'FAILED';
  sentAt: Date | null;
  failureReason: string | null;
  
  createdAt: Date;
  updatedAt: Date;
}
```

### 설계 원칙

#### 1단계: Contact당 1개 메시지 (충돌 없음)
```
Campaign: "2026 카리브해 크루즈"
├─ Channel: Email
│  └─ Contact_A: status='SENT' ✅
│
└─ Channel: SMS (분리 발송 시)
   └─ Contact_A: status='SENT' ✅
```

**현재 아키텍처**:
- 동일 Contact에 Email과 SMS를 **순차적으로** 발송
- 동시성 문제 없음
- 각 행(row)은 독립적인 발송 기록

#### 2단계: 데이터 복잡도 최소화
```sql
-- ❌ Phase 4 (분리 설계)
SELECT * FROM sending_history
WHERE contact_id='contact_123' AND campaign_id='campaign_456';
-- 결과: 2개 행 (Email 1줄, SMS 1줄)
--      emailStatus, smsStatus 공존 (혼동 가능)

-- ✅ Phase 3 (통합 설계)
SELECT * FROM sending_history
WHERE contact_id='contact_123' AND campaign_id='campaign_456';
-- 결과: 2개 행 (Email 1줄, SMS 1줄)
--      status 필드 명확 (혼동 없음)
```

#### 3단계: 감시 목적에 충분
```typescript
// 캠페인 성공률 모니터링
const emailStats = await db.sendingHistory.groupBy({
  by: ['status'],
  where: { 
    campaignId: 'campaign_123',
    channel: 'email'  // ✅ channel 필드로 충분
  },
  _count: { id: true }
});

// {
//   status: 'SENT',
//   _count: { id: 245 }  // Email 발송 성공 245건
// }
// {
//   status: 'FAILED',
//   _count: { id: 3 }    // Email 발송 실패 3건
// }
```

## 현재 쿼리 패턴 (Phase 3)

### 패턴 1: 채널별 발송 현황
```sql
-- Email 발송 현황
SELECT COUNT(*) as count
FROM sending_history 
WHERE campaign_id='campaign_123' 
  AND channel='email' 
  AND status='SENT';
-- 결과: 245

-- SMS 발송 현황
SELECT COUNT(*) as count
FROM sending_history 
WHERE campaign_id='campaign_123' 
  AND channel='sms' 
  AND status='SENT';
-- 결과: 240
```

### 패턴 2: 발송 실패 원인 분석
```sql
-- Email 중 어떤 상태인지 확인
SELECT status, COUNT(*) as count
FROM sending_history 
WHERE campaign_id='campaign_123' AND channel='email'
GROUP BY status;

-- 결과:
-- status='SENT'   | count=245
-- status='FAILED' | count=3
-- status='PENDING'| count=2
```

### 패턴 3: 고객별 발송 이력
```sql
-- 고객 contact_A가 받은 모든 메시지
SELECT id, channel, subject, status, sent_at
FROM sending_history 
WHERE contact_id='contact_A' AND campaign_id='campaign_123'
ORDER BY created_at DESC;

-- 결과:
-- id=1 | channel=email | status=SENT   | sent_at=2026-05-18T14:00:00Z
-- id=2 | channel=sms   | status=SENT   | sent_at=2026-05-18T14:05:00Z
```

## 왜 emailStatus/smsStatus로 분리하지 않나?

### 분리 설계의 문제점
```typescript
// ❌ Phase 4 스타일 (분리)
interface SendingHistoryMultiChannel {
  id: string;
  campaignId: string;
  contactId: string;
  channel: 'email' | 'sms';
  
  // 문제 1: 중복된 필드
  emailStatus?: 'PENDING' | 'SENT' | 'FAILED' | 'BOUNCED';
  smsStatus?: 'PENDING' | 'SENT' | 'FAILED' | 'INVALID';
  // → Email 행에는 emailStatus만 채워짐, smsStatus는 null
  // → SMS 행에는 smsStatus만 채워짐, emailStatus는 null
  
  // 문제 2: 쿼리 복잡도
  status: ?;  // status 필드가 필요한가? 중복인가?
}

// 쿼리 예시
SELECT * FROM sending_history 
WHERE campaign_id='123' AND (
  (channel='email' AND email_status='SENT')
  OR (channel='sms' AND sms_status='SENT')
);
// → OR 조건 필요 (인덱스 성능 저하)
```

### Phase 3 설계의 장점
```typescript
// ✅ Phase 3 스타일 (통합)
interface SendingHistory {
  id: string;
  campaignId: string;
  contactId: string;
  channel: 'email' | 'sms';  // 채널 구분
  status: 'PENDING' | 'SENT' | 'FAILED'; // 상태 통합
}

// 쿼리 단순화
SELECT * FROM sending_history 
WHERE campaign_id='123' AND channel='email' AND status='SENT';
// → 단순 AND 조건 (인덱스 최적화)

// 인덱스 구성
CREATE INDEX idx_campaign_channel_status 
ON sending_history(campaign_id, channel, status);
```

## Phase 3에서 처리할 수 없는 케이스

| 케이스 | Phase 3 | Phase 4 해결 |
|--------|--------|-----------|
| **Email 발송 성공, SMS 발송 실패** | ✅ 처리 가능 (2개 행) | ✅ emailStatus/smsStatus로 더 명시적 표현 |
| **Email 다시 발송** | ✅ 새 행 생성 | ✅ 동일 (변경 없음) |
| **SMS 자동 폴백** | ❌ 구현 불가 | ✅ emailStatus='FAILED' → smsStatus 확인 후 발송 |
| **채널별 상태 통계** | ✅ channel로 필터링 | ✅ emailStatus/smsStatus로 더 정확 |

## Phase 4 계획 (향후)

### 언제 전환?
```
현재 (2026-05-18): Phase 3
│
└─ 조건: 멀티채널 동시 발송 필요 OR 채널별 폴백 로직
   └─ Phase 4로 전환 (TBD)
```

### Phase 4 스키마 예상
```typescript
interface SendingHistory {
  id: string;
  campaignId: string;
  contactId: string;
  channel: 'email' | 'sms' | 'push'; // 채널 확대
  
  // Phase 3 필드 (유지)
  subject: string;
  body: string;
  metadata: Record<string, any>;
  
  // Phase 4 필드 (추가)
  status: 'PENDING' | 'SENT' | 'FAILED'; // 호환성용 (레거시)
  emailStatus?: 'PENDING' | 'SENT' | 'FAILED' | 'BOUNCED' | 'COMPLAINED';
  smsStatus?: 'PENDING' | 'SENT' | 'FAILED' | 'INVALID' | 'UNSUBSCRIBED';
  pushStatus?: 'PENDING' | 'SENT' | 'FAILED' | 'UNINSTALLED';
  
  // 폴백 추적
  fallbackChannel?: 'sms' | 'push'; // Email 실패 시 SMS로 전환
  fallbackedAt?: Date;
  fallbackReason?: string;
}
```

### Phase 4 마이그레이션 전략
```sql
-- Step 1: 신규 필드 추가 (NULL 허용)
ALTER TABLE sending_history 
ADD COLUMN email_status VARCHAR(50),
ADD COLUMN sms_status VARCHAR(50),
ADD COLUMN fallback_channel VARCHAR(50),
ADD COLUMN fallbacked_at TIMESTAMP;

-- Step 2: 기존 데이터 마이그레이션
UPDATE sending_history 
SET 
  email_status = CASE WHEN channel='email' THEN status ELSE NULL END,
  sms_status = CASE WHEN channel='sms' THEN status ELSE NULL END
WHERE created_at < '2026-05-18'::timestamp;

-- Step 3: 신규 로직 적용 (Phase 4 크론 작업)
-- → emailStatus='FAILED' 감지 → SMS 발송 시도
```

## 실제 구현 예시

### SendingHistory 저장 (현재)
```typescript
async function saveToHistory(
  campaign: Campaign,
  contact: Contact,
  channel: 'email' | 'sms',
  status: 'PENDING' | 'SENT' | 'FAILED'
) {
  return await db.sendingHistory.create({
    data: {
      campaignId: campaign.id,
      contactId: contact.id,
      channel,           // Email이면 'email', SMS면 'sms'
      status,            // 모든 채널이 동일 상태 필드 사용
      subject: campaign.title,
      body: renderedContent,
      metadata: {
        segmentId: contact.segmentId,
        timestamp: new Date().toISOString()
      }
    }
  });
}
```

### 쿼리 (현재 방식)
```typescript
// Email 발송 성공 건수
const emailSent = await db.sendingHistory.count({
  where: {
    campaignId: 'campaign_123',
    channel: 'email',
    status: 'SENT'
  }
});

// SMS 발송 성공 건수
const smsSent = await db.sendingHistory.count({
  where: {
    campaignId: 'campaign_123',
    channel: 'sms',
    status: 'SENT'
  }
});
```

### 폴백 로직 (Phase 4에서 필요할 때)
```typescript
// Phase 4 예상 코드 (현재는 구현 안 함)
/*
async function sendWithFallback(campaign, contact) {
  // Step 1: Email 발송 시도
  let emailResult = await sendEmail(contact.email, campaign.html);
  if (emailResult.status === 'SENT') {
    await saveToHistory(campaign, contact, 'email', 'SENT', {
      emailStatus: 'SENT',
      smsStatus: null
    });
    return;
  }
  
  // Step 2: Email 실패 → SMS로 자동 폴백
  if (emailResult.status === 'FAILED') {
    let smsResult = await sendSMS(contact.phone, campaign.smsBody);
    await saveToHistory(campaign, contact, 'sms', 'SENT', {
      emailStatus: 'FAILED',
      smsStatus: smsResult.status,
      fallbackChannel: 'sms',
      fallbackedAt: new Date()
    });
  }
}
*/
```

## 데이터 일관성 보장

### 규칙 1: Status 유효성
```typescript
// Phase 3 - status는 항상 3가지 중 1개
const validStatuses = ['PENDING', 'SENT', 'FAILED'];
if (!validStatuses.includes(status)) {
  throw new Error('Invalid status');
}
```

### 규칙 2: Channel 유효성
```typescript
// Phase 3 - channel은 2가지 중 1개
const validChannels = ['email', 'sms'];
if (!validChannels.includes(channel)) {
  throw new Error('Invalid channel');
}
```

### 규칙 3: 행 조회 시 채널별 분리
```sql
-- Contact_A가 Campaign_B에서 받은 Email 발송 기록
SELECT * FROM sending_history
WHERE contact_id='contact_A' AND campaign_id='campaign_B' AND channel='email';
-- 결과: Email 발송 기록 1개 (또는 여러 개, 각각 독립적)

-- Contact_A가 Campaign_B에서 받은 SMS 발송 기록
SELECT * FROM sending_history
WHERE contact_id='contact_A' AND campaign_id='campaign_B' AND channel='sms';
-- 결과: SMS 발송 기록 1개 (또는 여러 개, 각각 독립적)
```

## 용어 정의

| 용어 | 정의 | Phase 3 | Phase 4 |
|------|------|---------|---------|
| **status** | 메시지 발송 상태 (통합) | ✅ 사용 | ✅ 호환성용 유지 |
| **channel** | 발송 채널 (Email/SMS) | ✅ 사용 | ✅ 사용 |
| **emailStatus** | Email 전용 상태 | ❌ 없음 | ✅ 추가 |
| **smsStatus** | SMS 전용 상태 | ❌ 없음 | ✅ 추가 |
| **fallbackChannel** | 폴백 채널 | ❌ 없음 | ✅ 추가 |

## FAQ

### Q: Email 발송 실패했을 때 어떻게 SMS로 자동 전환?
**A**: Phase 3에서는 자동 폴백을 구현하지 않습니다. 수동으로 재발송합니다. Phase 4에서 폴백 로직을 추가할 예정입니다.

### Q: 같은 고객에게 Email과 SMS를 동시에 발송하면?
**A**: SendingHistory에 2개 행이 생깁니다 (channel='email' 1줄, channel='sms' 1줄). 각각 독립적인 status를 가집니다.

### Q: 통계를 낼 때 "Email은 성공했는데 SMS는 실패"하는 경우?
**A**: 쿼리에서 channel로 필터링하면 정확히 파악됩니다:
```sql
WHERE campaign_id='123' AND channel='email' AND status='SENT' -- Email 성공만
WHERE campaign_id='123' AND channel='sms' AND status='FAILED' -- SMS 실패만
```

### Q: Phase 4 전환 시 기존 데이터는?
**A**: 마이그레이션으로 처리합니다:
```sql
UPDATE sending_history 
SET email_status = status WHERE channel='email';
UPDATE sending_history 
SET sms_status = status WHERE channel='sms';
```

## 결론

✅ **Phase 3: 단순한 설계**
- status 필드 1개 (PENDING/SENT/FAILED)
- channel로 구분 (Email/SMS)
- Contact당 최대 2개 행 (Email 1줄 + SMS 1줄)

✅ **Phase 4: 향후 확장 (필요할 때)**
- emailStatus/smsStatus 분리
- 폴백 로직 추가
- Push 채널 추가

**핵심**: 지금은 단순함으로 유지 → 나중에 필요할 때 확장 가능
