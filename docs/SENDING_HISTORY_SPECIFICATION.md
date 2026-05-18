# Menu #38 Phase 2: SendingHistory 모델 스펙

## 개요

**SendingHistory** 모델은 메뉴 #38 마케팅 자동화의 핵심 추적 시스템입니다.
- 템플릿 / 자동화 규칙 / 캠페인 발송 이력을 통합 관리
- SMS + Email 채널 지원
- 재시도 로직 (최대 3회) 및 Cron Job 스케줄링
- 상호작용 추적 (클릭, 등록, 랜딩 페이지 조회)

---

## 데이터베이스 스키마

### 테이블 명
```
SendingHistory
```

### 필드 정의

#### 기본 필드
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `id` | CUID | - | 유일 식별자 |
| `organizationId` | String | - | 조직 ID (FK) |
| `createdAt` | DateTime | NOW() | 생성 시간 |
| `updatedAt` | DateTime | NOW() | 수정 시간 |

#### 발송 식별자
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `sendingType` | String | - | 발송 타입: TEMPLATE \| AUTOMATION \| CAMPAIGN |
| `sourceId` | String? | NULL | 템플릿/규칙/캠페인 ID |
| `campaignId` | String? | NULL | 캠페인 ID (Phase 2 추가) |

#### 수신자 정보
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `contactId` | String | - | 고객 ID |
| `phone` | String? | NULL | 휴대폰 번호 스냅샷 |
| `email` | String? | NULL | 이메일 주소 스냅샷 |

#### 채널 & 메시지
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `channel` | String | - | SMS \| EMAIL |
| `subject` | String? | NULL | 이메일 제목 |
| `body` | String | - | 발송된 메시지 본문 |

#### 발송 상태
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `status` | SendingStatus | PENDING | PENDING \| SENT \| FAILED \| SKIPPED \| RETRY_SCHEDULED \| ABANDONED |
| `failureReason` | SendingFailureReason? | NULL | 실패 원인 분류 |
| `failureUserMsg` | String? | NULL | 사용자 친화 메시지 (한국어) |
| `failureMessage` | String? | NULL | 상세 에러 메시지 (내부용) |

#### 재시도 로직 (Phase 2 추가)
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `retryCount` | Int | 0 | 현재까지의 재시도 횟수 |
| `maxRetries` | Int | 3 | 최대 재시도 횟수 |
| `nextRetryAt` | DateTime? | NULL | 다음 재시도 예정 시간 |

#### 공급자 추적
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `messageId` | String? | NULL | SMS: Aligo msg_id / Email: 제공자 ID |
| `deliveredAt` | DateTime? | NULL | 배송 완료 시간 |
| `webhookAttempts` | Int | 0 | Webhook 콜백 시도 횟수 |
| `lastWebhookAt` | DateTime? | NULL | 마지막 Webhook 호출 시간 |

#### 채널별 상태 추적 (Phase 2 추가)
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `emailStatus` | String? | NULL | PENDING \| SENT \| BOUNCE \| COMPLAINT |
| `emailSentAt` | DateTime? | NULL | 이메일 발송 시간 |
| `emailOpenedAt` | DateTime? | NULL | 이메일 오픈 시간 |
| `smsStatus` | String? | NULL | PENDING \| SENT \| DELIVERY_FAIL |
| `smsSentAt` | DateTime? | NULL | SMS 발송 시간 |

#### 상호작용 추적 (Phase 2 추가)
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `linkClickedAt` | DateTime? | NULL | 랜딩 링크 클릭 시간 |
| `registeredAt` | DateTime? | NULL | 상품 등록 시간 |
| `landingPageViewId` | String? | NULL | 랜딩 페이지 방문 기록 ID |

#### 발송 일정
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `scheduledAt` | DateTime | - | 발송 예정 시간 |
| `sentAt` | DateTime? | NULL | 실제 발송 시간 |

#### 메타정보 (Phase 2 추가)
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `metadata` | JSONB? | NULL | 추가 속성: userAgent, ipAddress, customData 등 |

---

## Enum 정의

### SendingStatus
```typescript
enum SendingStatus {
  PENDING            // 발송 대기
  SENT               // 발송 성공 (상호작용 추적 중)
  FAILED             // 발송 실패 (최대 재시도 초과)
  SKIPPED            // 건너뜀 (조건 미충족)
  RETRY_SCHEDULED    // 재시도 예정
  ABANDONED          // 최대 재시도 초과 (포기)
}
```

### SendingFailureReason
```typescript
enum SendingFailureReason {
  INVALID_EMAIL      // 유효하지 않은 이메일 형식
  INVALID_PHONE      // 유효하지 않은 휴대폰 번호
  OPT_OUT           // 고객 수신거부 상태
  QUOTA_EXCEEDED    // 일일/월간 발송 한도 초과
  SYSTEM_ERROR      // CRM 내부 오류
  PROVIDER_ERROR    // SMS/Email 서비스 오류
  NETWORK_ERROR     // 네트워크 연결 오류
  BOUNCE            // 이메일 반송 (Hard/Soft Bounce)
}
```

---

## 인덱스 전략

### 1. 재시도 스캔 (Cron Job 최적화)
```sql
CREATE INDEX idx_sending_history_retry_scan 
ON SendingHistory(status, nextRetryAt)
WHERE status IN ('PENDING', 'RETRY_SCHEDULED') AND nextRetryAt IS NOT NULL;
```
**용도**: Cron Job이 재시도할 대상을 빠르게 찾음
**쿼리**: `SELECT * FROM SendingHistory WHERE status IN ('PENDING', 'RETRY_SCHEDULED') AND nextRetryAt <= NOW()`

### 2. 캠페인별 상태 통계
```sql
CREATE INDEX idx_sending_history_campaign_status
ON SendingHistory(campaignId, status)
WHERE campaignId IS NOT NULL;
```
**용도**: 캠페인 성과 집계 (발송/실패/오픈 비율)
**쿼리**: `SELECT status, COUNT(*) FROM SendingHistory WHERE campaignId = ? GROUP BY status`

### 3. 고객별 발송 이력
```sql
CREATE INDEX idx_sending_history_contact_campaign
ON SendingHistory(contactId, campaignId)
WHERE campaignId IS NOT NULL;
```
**용도**: 특정 고객에게 발송한 캠페인 추적
**쿼리**: `SELECT * FROM SendingHistory WHERE contactId = ? AND campaignId = ?`

### 4. 조직별 시간대별 조회
```sql
CREATE INDEX idx_sending_history_org_time
ON SendingHistory(organizationId, createdAt DESC);
```
**용도**: 대시보드 / 최근 발송 이력 조회
**쿼리**: `SELECT * FROM SendingHistory WHERE organizationId = ? ORDER BY createdAt DESC LIMIT 100`

### 5. 상태별 재시도 필요 여부
```sql
CREATE INDEX idx_sending_history_status_retry
ON SendingHistory(status, retryCount)
WHERE retryCount < maxRetries;
```
**용도**: 재시도 가능 대상 필터링
**쿼리**: `SELECT * FROM SendingHistory WHERE status = 'FAILED' AND retryCount < maxRetries`

### Unique 제약조건 (중복 방지)
```sql
ALTER TABLE SendingHistory
ADD CONSTRAINT unique_sending_history_campaign_contact
UNIQUE (campaignId, contactId)
WHERE campaignId IS NOT NULL;
```
**용도**: 같은 캠페인에서 고객에게 중복 발송 방지

---

## 재시도 로직

### 상태 전이도
```
PENDING (발송 예정)
  ↓
SENT (발송 성공) → [상호작용 추적]
  ↓
  linkClickedAt, registeredAt 기록

PENDING (발송 예정)
  ↓
  실패 발생
  ↓
RETRY_SCHEDULED (재시도 예정)
  ↓ nextRetryAt 갱신, retryCount++
  ↓
PENDING (재시도 대기) [Cron Job이 발동]
  ↓
SENT (성공) 또는 FAILED (최종 실패)
  ↓
retryCount >= maxRetries (3)
  ↓
ABANDONED (포기)
```

### Cron Job 로직
```sql
-- 1. 재시도할 대상 찾기 (5분마다 실행)
SELECT * FROM SendingHistory
WHERE status IN ('PENDING', 'RETRY_SCHEDULED')
AND nextRetryAt <= NOW()
ORDER BY nextRetryAt ASC
LIMIT 1000;

-- 2. 각 레코드에 대해 발송 재시도
-- 성공: status = 'SENT', sentAt = NOW()
-- 실패: status = 'RETRY_SCHEDULED', nextRetryAt = NOW() + 5분, retryCount++

-- 3. 최대 재시도 초과 처리
IF retryCount >= maxRetries:
  UPDATE SendingHistory SET status = 'ABANDONED' WHERE id = ?;
```

### 재시도 스케줄
| 시도 | 대기 시간 | 누적 시간 |
|------|----------|----------|
| 1차 | 5분 | 5분 |
| 2차 | 15분 | 20분 |
| 3차 | 1시간 | 1시간 20분 |
| 포기 | - | ABANDONED |

---

## CrmMarketingCampaign 통계 필드

### 추가 필드
```typescript
model CrmMarketingCampaign {
  // 기존 필드
  totalCount        Int = 0          // 캠페인 대상 고객 수
  sentCount         Int = 0          // 발송 성공 수
  
  // Phase 2 추가 필드
  failedCount       Int = 0          // 발송 실패 수
  skippedCount      Int = 0          // 건너뜀 수
  openCount         Int = 0          // 이메일 오픈 수
  clickCount        Int = 0          // 링크 클릭 수
  registeredCount   Int = 0          // 상품 등록 수
}
```

### 통계 집계 쿼리
```sql
-- 캠페인별 성과 대시보드
SELECT 
  campaignId,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'SENT' THEN 1 END) as sent,
  COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed,
  COUNT(CASE WHEN status = 'SKIPPED' THEN 1 END) as skipped,
  COUNT(CASE WHEN emailOpenedAt IS NOT NULL THEN 1 END) as opened,
  COUNT(CASE WHEN linkClickedAt IS NOT NULL THEN 1 END) as clicked,
  COUNT(CASE WHEN registeredAt IS NOT NULL THEN 1 END) as registered
FROM SendingHistory
WHERE campaignId = ?
GROUP BY campaignId;
```

---

## 사용 예시

### 1. 캠페인 발송 이력 생성
```typescript
const sending = await prisma.sendingHistory.create({
  data: {
    organizationId: 'org-123',
    sendingType: 'CAMPAIGN',
    sourceId: 'campaign-456',
    campaignId: 'campaign-456',
    contactId: 'contact-789',
    phone: '+8210xxxxxxxx',
    email: 'user@example.com',
    channel: 'SMS',
    body: '쿠핑 이벤트: 30% 할인...',
    status: 'PENDING',
    scheduledAt: new Date(Date.now() + 5 * 60000), // 5분 후
    maxRetries: 3,
  },
});
```

### 2. 발송 성공 업데이트
```typescript
await prisma.sendingHistory.update({
  where: { id: 'sending-123' },
  data: {
    status: 'SENT',
    sentAt: new Date(),
    messageId: 'aligo-msg-999',
    smsStatus: 'SENT',
    smsSentAt: new Date(),
  },
});
```

### 3. 재시도 스케줄
```typescript
const failed = await prisma.sendingHistory.update({
  where: { id: 'sending-123' },
  data: {
    status: 'RETRY_SCHEDULED',
    failureReason: 'PROVIDER_ERROR',
    failureUserMsg: 'SMS 서비스 일시 오류',
    retryCount: 1,
    nextRetryAt: new Date(Date.now() + 5 * 60000), // 5분 후 재시도
  },
});
```

### 4. 클릭 추적
```typescript
await prisma.sendingHistory.update({
  where: { id: 'sending-123' },
  data: {
    linkClickedAt: new Date(),
    landingPageViewId: 'lpview-555',
  },
});
```

### 5. 캠페인 통계 조회
```typescript
const stats = await prisma.sendingHistory.groupBy({
  by: ['campaignId', 'status'],
  where: { campaignId: 'campaign-456' },
  _count: true,
});

// 결과:
// { campaignId, status: 'SENT', _count: 450 }
// { campaignId, status: 'FAILED', _count: 5 }
// { campaignId, status: 'PENDING', _count: 45 }
```

---

## 성능 고려사항

### 1. 인덱스 크기 최소화
- `CONCURRENTLY` 옵션으로 락 없이 인덱스 생성
- 필터링된 인덱스 (`WHERE` 조건)로 불필요한 행 제외

### 2. 쿼리 최적화
- Cron Job: 상태 + 시간으로 인덱스 활용
- 캠페인 통계: 캠페인 ID + 상태 복합 인덱스
- 제한 조건 사용 (`LIMIT 1000`)

### 3. 파티셔닝 (향후)
- 월별 파티셔닝으로 대규모 데이터 관리
- 예: `SendingHistory_2025_01`, `SendingHistory_2025_02`

### 4. 배치 처리
- 대량 발송: `insertMany()` 사용
- 통계 갱신: 배치 업데이트

---

## 마이그레이션 안전성

### 기존 데이터 호환성
- 기존 `SendingHistory` 필드 유지
- 새 필드는 NULL 기본값 (역호환성)
- `CONCURRENTLY` 옵션으로 락 최소화

### 마이그레이션 순서
1. 새 필드 추가 (ALTER TABLE)
2. 외래키 제약조건 추가
3. 인덱스 생성 (CONCURRENTLY)
4. Unique 제약조건 추가

### 롤백 전략
```sql
-- 롤백: 필드 제거
ALTER TABLE SendingHistory DROP COLUMN campaignId;
ALTER TABLE SendingHistory DROP COLUMN retryCount;
-- ... (다른 필드들)
```

---

## 주요 용어

| 용어 | 설명 |
|------|------|
| **SendingType** | 발송의 출처: 템플릿, 자동화 규칙, 캠페인 |
| **SourceId** | 발송 출처의 ID (templateId, ruleId, campaignId) |
| **Channel** | 발송 채널: SMS, Email |
| **Status** | 발송 상태: PENDING, SENT, FAILED, SKIPPED, RETRY_SCHEDULED, ABANDONED |
| **FailureReason** | 실패 원인 분류 (정확성 + 통계 분석용) |
| **MessageId** | SMS/Email 제공자의 메시지 ID (배송 추적용) |
| **RetryCount** | 현재까지의 재시도 횟수 |
| **NextRetryAt** | 다음 재시도 예정 시간 (Cron Job 스케줄링) |
| **Webhook** | SMS 배송 완료 콜백 (Aligo) |

---

## 관련 문서

- [Menu #38 최종 작업지시서](menu_38_final_work_instructions.md)
- [Prisma 테이블 매핑 가이드](reference_prisma_table_mappings.md)
- [마케팅 캠페인 스펙](project_marketing_campaign_spec.md)

---

**작성**: 2026-05-19
**버전**: 1.0
**상태**: Phase 2 구현 중
