# Phase 4 향후 스키마 변경 계획

## 개요
Phase 3 이후 ExecutionLog와 SendingHistory의 확장 로드맵.

## Phase 3 → Phase 4 전환 시점

### Phase 4 진입 조건 (3가지 중 1개)
1. **멀티채널 폴백 필요**
   - Email 실패 → SMS 자동 발송
   - SMS 실패 → Push 알림

2. **채널별 세부 상태 추적**
   - Email: BOUNCED, COMPLAINED 같은 Sendgrid 후처리 이벤트
   - SMS: UNDELIVERED, UNSUBSCRIBED 같은 Aligo 후처리 이벤트

3. **메시지 아카이브 필수**
   - 감시 로그 접근 시 원본 메시지 필요
   - S3 저장소로 contentUrl 관리

### 예상 일정
```
2026-05-18: Phase 3 배포 (현재)
│
2026-06-15: Phase 4 검토 (4주 후)
│  ├─ 폴백 요청 및 분석
│  ├─ 채널별 상태 필요성 재검토
│  └─ 메시지 아카이브 규정 확인
│
2026-07-01: Phase 4 구현 (예상, TBD)
```

## ExecutionLog 확장

### 현재 (Phase 3)
```typescript
interface ExecutionLog {
  id: string;
  campaignId: string;
  contactId: string;
  
  type: 'SEND_EMAIL' | 'SEND_SMS' | 'QUERY' | 'FILTER';
  status: 'STARTED' | 'COMPLETED' | 'FAILED';
  
  startedAt: Date;
  completedAt: Date | null;
  duration: number; // ms
  retries: number;
  
  sourceName: string; // 크론 작업 이름
  error: string | null;
  metadata: Record<string, any>; // 성능 로깅만
}
```

### Phase 4 확장안
```typescript
interface ExecutionLog {
  id: string;
  campaignId: string;
  contactId: string;
  
  type: 'SEND_EMAIL' | 'SEND_SMS' | 'SEND_PUSH' | 'QUERY' | 'FILTER';
  status: 'STARTED' | 'COMPLETED' | 'FAILED';
  
  startedAt: Date;
  completedAt: Date | null;
  duration: number; // ms
  retries: number;
  
  sourceName: string;
  error: string | null;
  
  // ⭐ Phase 4 신규 필드
  contentUrl: string | null;              // S3 저장소 링크
  emailStatus?: 'PENDING' | 'SENT' | 'FAILED' | 'BOUNCED' | 'COMPLAINED';
  smsStatus?: 'PENDING' | 'SENT' | 'FAILED' | 'INVALID' | 'UNDELIVERED';
  pushStatus?: 'PENDING' | 'SENT' | 'FAILED' | 'UNINSTALLED';
  
  // ⭐ Phase 4 폴백 추적
  fallbackChannel?: 'sms' | 'push';      // 폴백된 채널
  fallbackedAt?: Date;                   // 폴백 시간
  fallbackReason?: string;               // 폴백 원인 (메시지)
  
  metadata: Record<string, any>;
  
  // ⭐ Phase 4 감시 강화
  apiProvider?: string;                  // 'sendgrid' | 'aligo' 등
  externalMessageId?: string;            // 외부 시스템 메시지 ID
  retrySchedule?: Date[];                // 재시도 일정
}
```

### 마이그레이션 SQL
```sql
-- Step 1: 신규 필드 추가 (NULL 허용, 기본값 설정)
ALTER TABLE execution_log 
ADD COLUMN content_url TEXT,
ADD COLUMN email_status VARCHAR(50),
ADD COLUMN sms_status VARCHAR(50),
ADD COLUMN push_status VARCHAR(50),
ADD COLUMN fallback_channel VARCHAR(50),
ADD COLUMN fallbacked_at TIMESTAMP,
ADD COLUMN fallback_reason TEXT,
ADD COLUMN api_provider VARCHAR(50),
ADD COLUMN external_message_id VARCHAR(255),
ADD COLUMN retry_schedule TIMESTAMP[];

-- Step 2: 인덱스 추가 (성능 최적화)
CREATE INDEX idx_execution_log_content_url 
ON execution_log(campaign_id, contact_id, content_url);

CREATE INDEX idx_execution_log_email_status 
ON execution_log(campaign_id, email_status) 
WHERE email_status IS NOT NULL;

CREATE INDEX idx_execution_log_sms_status 
ON execution_log(campaign_id, sms_status) 
WHERE sms_status IS NOT NULL;

CREATE INDEX idx_execution_log_fallback 
ON execution_log(campaign_id, fallback_channel) 
WHERE fallback_channel IS NOT NULL;

-- Step 3: 제약 조건 추가
ALTER TABLE execution_log 
ADD CONSTRAINT check_email_status 
CHECK (email_status IS NULL OR email_status IN ('PENDING', 'SENT', 'FAILED', 'BOUNCED', 'COMPLAINED'));

ALTER TABLE execution_log 
ADD CONSTRAINT check_sms_status 
CHECK (sms_status IS NULL OR sms_status IN ('PENDING', 'SENT', 'FAILED', 'INVALID', 'UNDELIVERED'));

ALTER TABLE execution_log 
ADD CONSTRAINT check_push_status 
CHECK (push_status IS NULL OR push_status IN ('PENDING', 'SENT', 'FAILED', 'UNINSTALLED'));
```

## SendingHistory 확장

### 현재 (Phase 3)
```typescript
interface SendingHistory {
  id: string;
  campaignId: string;
  contactId: string;
  channel: 'email' | 'sms';
  
  subject: string;
  body: string;
  metadata: Record<string, any>;
  
  status: 'PENDING' | 'SENT' | 'FAILED';
  sentAt: Date | null;
  failureReason: string | null;
  
  createdAt: Date;
  updatedAt: Date;
}
```

### Phase 4 확장안
```typescript
interface SendingHistory {
  id: string;
  campaignId: string;
  contactId: string;
  channel: 'email' | 'sms' | 'push';  // Push 채널 추가
  
  subject: string;
  body: string;
  metadata: Record<string, any>;
  
  // Phase 3 필드 (호환성)
  status: 'PENDING' | 'SENT' | 'FAILED';
  sentAt: Date | null;
  failureReason: string | null;
  
  // ⭐ Phase 4 신규 필드
  contentUrl?: string;                   // S3 아카이브 링크
  emailStatus?: 'PENDING' | 'SENT' | 'FAILED' | 'BOUNCED' | 'COMPLAINED';
  smsStatus?: 'PENDING' | 'SENT' | 'FAILED' | 'INVALID' | 'UNDELIVERED';
  pushStatus?: 'PENDING' | 'SENT' | 'FAILED' | 'UNINSTALLED';
  
  // ⭐ Phase 4 폴백 정보
  fallbackChannel?: 'sms' | 'push';
  fallbackedAt?: Date;
  fallbackReason?: string;
  
  // ⭐ Phase 4 추적 강화
  externalMessageId?: string;            // Sendgrid/Aligo 메시지 ID
  deliveryTime?: Date;                   // 최종 배달 시간
  openedAt?: Date;                       // Email 오픈 시간
  clickedAt?: Date;                      // Email 클릭 시간
  unsubscribedAt?: Date;                 // 구독 해제 시간
  
  apiProvider?: string;                  // 'sendgrid' | 'aligo' 등
  
  createdAt: Date;
  updatedAt: Date;
}
```

### 마이그레이션 SQL
```sql
-- Step 1: 신규 필드 추가
ALTER TABLE sending_history 
ADD COLUMN content_url TEXT,
ADD COLUMN email_status VARCHAR(50),
ADD COLUMN sms_status VARCHAR(50),
ADD COLUMN push_status VARCHAR(50),
ADD COLUMN fallback_channel VARCHAR(50),
ADD COLUMN fallbacked_at TIMESTAMP,
ADD COLUMN fallback_reason TEXT,
ADD COLUMN external_message_id VARCHAR(255),
ADD COLUMN delivery_time TIMESTAMP,
ADD COLUMN opened_at TIMESTAMP,
ADD COLUMN clicked_at TIMESTAMP,
ADD COLUMN unsubscribed_at TIMESTAMP,
ADD COLUMN api_provider VARCHAR(50);

-- Step 2: 인덱스 추가 (성능)
CREATE INDEX idx_sending_history_content_url 
ON sending_history(campaign_id, contact_id, content_url);

CREATE INDEX idx_sending_history_external_id 
ON sending_history(external_message_id);

CREATE INDEX idx_sending_history_delivery_time 
ON sending_history(campaign_id, delivery_time);

CREATE INDEX idx_sending_history_engagement 
ON sending_history(campaign_id, channel, opened_at, clicked_at);

-- Step 3: 생성 인덱스 (자동 통계)
CREATE INDEX idx_sending_history_engagement_stats
ON sending_history(campaign_id, channel)
INCLUDE (opened_at, clicked_at, unsubscribed_at);
```

## contentUrl 구조 (S3 아카이브)

### S3 버킷 구조
```
s3://mabiz-crm-campaigns/
├── campaigns/
│   ├── campaign_123/
│   │   ├── messages/
│   │   │   ├── msg_001.html          # Email 본문
│   │   │   ├── msg_002.html
│   │   │   └── msg_003.json          # SMS (JSON)
│   │   └── metadata.json
│   │
│   └── campaign_456/
│       └── messages/
│           └── msg_456.html
│
└── archives/
    └── 2026-05-18/
        └── campaign_123_backup.tar.gz
```

### contentUrl 형식
```
Email:  s3://mabiz-crm-campaigns/campaigns/campaign_123/messages/msg_001.html
SMS:    s3://mabiz-crm-campaigns/campaigns/campaign_123/messages/msg_002.json
Backup: s3://mabiz-crm-campaigns/archives/2026-05-18/campaign_123_backup.tar.gz
```

### 저장 시점
```typescript
// Phase 4 크론 작업
async function sendCampaignWithArchive(campaign) {
  for (const contact of contacts) {
    const rendered = renderTemplate(campaign.template, contact);
    
    // Step 1: S3에 메시지 저장
    const contentUrl = await uploadToS3(
      `campaigns/${campaign.id}/messages/msg_${contact.id}.html`,
      rendered.html
    );
    
    // Step 2: ExecutionLog에 contentUrl 저장
    await db.executionLog.create({
      data: {
        campaignId: campaign.id,
        contactId: contact.id,
        type: 'SEND_EMAIL',
        contentUrl,           // ⭐ S3 링크
        apiProvider: 'sendgrid',
        // 나머지 필드...
      }
    });
    
    // Step 3: SendingHistory에도 저장 (중복, 옵션)
    await db.sendingHistory.create({
      data: {
        campaignId: campaign.id,
        contactId: contact.id,
        channel: 'email',
        contentUrl,           // ⭐ 중복 저장
        body: rendered.html,  // Phase 3 유지
        // 나머지 필드...
      }
    });
  }
}
```

## 채널별 상태 전이도 (Phase 4)

### Email 상태 전이
```
PENDING
  ↓
SENT → BOUNCED (Hard bounce: 없는 주소)
     → COMPLAINED (User complained)
     → DELIVERED (확실한 배달)
     
FAILED
  ↓
(재시도) → PENDING → SENT / FAILED
```

### SMS 상태 전이
```
PENDING
  ↓
SENT → UNDELIVERED (망사 장애)
    → UNSUBSCRIBED (수신거부)
    → DELIVERED (확실한 배달)
    
FAILED
  ↓
(재시도) → PENDING → SENT / FAILED
```

### 상태 업데이트 방식
```typescript
// Webhook 수신 (Sendgrid 예)
POST /api/webhooks/sendgrid
{
  event: 'bounce',
  messageId: 'external_msg_id_123',
  reason: 'permanent',
  timestamp: 1716025200
}

// Phase 4 핸들러
async function handleSendgridWebhook(event) {
  const executionLog = await db.executionLog.findUnique({
    where: { externalMessageId: event.messageId }
  });
  
  // ⭐ Phase 4: emailStatus 업데이트
  await db.sendingHistory.update({
    where: { id: executionLog.id },
    data: {
      emailStatus: event.reason === 'permanent' ? 'BOUNCED' : 'FAILED'
    }
  });
}
```

## 호환성 보장

### 기존 쿼리의 작동 (Phase 3 ↔ Phase 4)
```typescript
// Phase 3 쿼리 (변경 없음)
const result = await db.sendingHistory.findMany({
  where: { 
    campaignId: 'campaign_123',
    status: 'SENT'  // ✅ Phase 4에서도 작동
  }
});

// Phase 4에서 동작 방식
// status='SENT' → (emailStatus='SENT' OR smsStatus='SENT' OR pushStatus='SENT')
// → 자동 변환 (ORM 레벨)
```

### 신규 쿼리 (Phase 4 전용)
```typescript
// Phase 4만 가능
const emailBounced = await db.sendingHistory.findMany({
  where: { 
    campaignId: 'campaign_123',
    emailStatus: 'BOUNCED'  // Phase 3에서는 NULL
  }
});
```

## 비용 추정

### S3 저장소
```
발송당 평균 크기: 5KB (HTML Email)
월간 발송: 100만 건

월간 저장소: 100만 × 5KB = 5GB
연간: 60GB

S3 비용 (Standard):
├─ 저장: 60GB × $0.023/GB = $1.38/년
├─ 요청 (PUT): 1200만 × $0.005/1M = $60/년
└─ 요청 (GET): 1200만 × $0.0004/1M = $4.8/년
→ 합계: ~$70/년 (무시할 수준)
```

### 데이터베이스
```
신규 필드 추가에 따른 행 크기 증가:
├─ 신규 컬럼: ~200바이트 (평균)
├─ 인덱스: ~300바이트

100만 행:
├─ 데이터: 100만 × 200B = 200MB
├─ 인덱스: 100만 × 300B = 300MB
└─ 합계: 500MB (무시할 수준)

Neon (크루즈닷몰 공유 DB)에 영향 미미
```

## 마이그레이션 전략 (Phase 4 진입 시)

### Step 1: 사전 검토 (1주)
- 폴백 요청 우선순위 확인
- 채널별 상태 정의 최종 확정
- S3 저장소 접근 권한 확인

### Step 2: 스키마 변경 (2-3시간, 온라인)
```sql
BEGIN TRANSACTION;
-- 신규 필드 추가 (NULL 허용)
ALTER TABLE execution_log ADD COLUMN content_url TEXT;
ALTER TABLE sending_history ADD COLUMN email_status VARCHAR(50);
-- ... (위의 마이그레이션 SQL 참고)
COMMIT;
```

### Step 3: 신규 로직 배포 (1일)
- 신규 필드를 활용하는 크론 작업 배포
- Webhook 핸들러 업데이트
- 롤백 계획 수립

### Step 4: 기존 데이터 마이그레이션 (선택사항)
```sql
-- 과거 데이터에 대해 선택적으로 status → emailStatus/smsStatus 복사
UPDATE sending_history 
SET email_status = status 
WHERE channel='email' AND email_status IS NULL;
```

### Step 5: 모니터링 (2주)
- 신규 필드 NULL 비율 모니터링
- API 성능 영향 확인
- 로그 저장소 용량 확인

## 결론

✅ **Phase 3 (현재)**
- 단순함 유지
- 필드 최소화

✅ **Phase 4 (향후)**
- contentUrl로 S3 아카이브 추가
- emailStatus/smsStatus 분리
- 폴백 로직 구현

**핵심**: 
1. Phase 3 = MVP (Minimum Viable Product)
2. Phase 4 = 프로덕션 레벨 (필요할 때만)
3. 마이그레이션 전략 미리 수립 (위험 최소화)
