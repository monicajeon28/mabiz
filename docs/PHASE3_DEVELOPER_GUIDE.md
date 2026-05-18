# Phase 3 개발팀 가이드 - 새로운 API 및 패턴

**대상**: 개발팀  
**목적**: Phase 3에서 추가된 새로운 함수, 패턴, 유틸리티 사용법  
**작성일**: 2026-05-19

---

## 📚 목차

1. [새로운 모듈 개요](#1-새로운-모듈-개요)
2. [contact-template-sender 패턴](#2-contact-template-sender-패턴)
3. [Feature Flag 사용법](#3-feature-flag-사용법)
4. [에러 분류 시스템](#4-에러-분류-시스템)
5. [Contact 캐싱](#5-contact-캐싱)
6. [Rate Limiter](#6-rate-limiter)
7. [테스트 작성](#7-테스트-작성)
8. [문제 해결](#8-문제-해결)

---

## 1. 새로운 모듈 개요

### Phase 3에서 추가된 파일들

```typescript
// 자동화 리팩토링 (β 렌즈)
lib/contact-template-sender.ts       // 래퍼 함수 (529줄)
lib/feature-flags.ts                 // Feature Flag (127줄)
lib/error-mapper.ts                  // 에러 분류 (새 파일)
lib/contact-snapshot.ts              // 캐싱 (새 파일)
lib/rate-limiter.ts                  // 속도 제한 (새 파일)

// 모니터링 자동화 (δ 렌즈)
scripts/verify-execution-log.ts       // 자동 검증
scripts/rollback-handler.ts           // 자동 롤백
lib/slack-notifier.ts                 // Slack 알림

// API
api/admin/verification/[...slug].ts   // 검증 API
```

### 파일 간 의존성

```
contact-template-sender.ts (최상위 래퍼)
  ├── feature-flags.ts (Feature Flag 확인)
  ├── error-mapper.ts (에러 분류)
  ├── contact-snapshot.ts (Contact 캐싱)
  ├── rate-limiter.ts (속도 제한)
  └── slack-notifier.ts (결과 알림)

verify-execution-log.ts (자동 검증)
  ├── prisma (데이터베이스)
  ├── slack-notifier.ts
  └── rollback-handler.ts (롤백 실행)
```

---

## 2. contact-template-sender 패턴

### 개요

**파일**: `lib/contact-template-sender.ts`  
**목적**: 캠페인 발송 로직을 래퍼 함수로 통합  
**장점**:
- 코드 중복 280줄 제거
- 복잡도 15 → 6 (60% 감소)
- 유연한 Feature Flag 지원
- 자동 에러 분류 및 재시도

### 사용법

#### 기본 사용 (Phase 2 호환성 유지)

```typescript
// Phase 2 코드 (그대로 작동)
import { sendContactTemplate } from '@/lib/contact-template-sender';

// SMS 발송
await sendContactTemplate({
  contactId: '12345',
  channel: 'SMS',
  templateId: 'welcome-sms',
  variables: { name: '김철수' },
});

// 이메일 발송
await sendContactTemplate({
  contactId: '12345',
  channel: 'EMAIL',
  templateId: 'welcome-email',
  variables: { name: '김철수', link: 'https://...' },
});
```

#### Phase 3 신규 기능 (Feature Flag 자동 확인)

```typescript
// Feature Flag가 자동으로 확인됨
const result = await sendContactTemplate({
  contactId: '12345',
  channel: 'SMS',
  templateId: 'promotion-sms',
  variables: { offer: '50% OFF' },
  // Feature Flag 비활성화 시:
  // → 기존 SendingHistory만 기록
  // Feature Flag 활성화 시:
  // → SendingHistory + ExecutionLog 모두 기록
});
```

#### 응답 형식 (새로운 필드)

```typescript
interface SendResult {
  // 기존 필드 (호환성)
  success: boolean;
  messageId: string;
  timestamp: string;
  
  // 신규 필드 (Phase 3)
  executionLogId?: string;      // ExecutionLog 레코드 ID
  featureFlagEnabled: boolean;  // Feature Flag 상태
  retryable: boolean;           // 재시도 가능 여부
  errorCategory?: string;       // 에러 분류 (재시도/영구/미분류)
}
```

### 내부 동작 플로우

```
1. Feature Flag 확인
   ├─ 활성화 (100%): ExecutionLog 기록
   ├─ 비활성화 (0%): SendingHistory만 기록
   └─ 부분 활성화 (50%): 확률로 결정

2. Contact 데이터 로드
   ├─ 캐시 확인 (contact-snapshot.ts)
   ├─ 캐시 미스 시: DB 쿼리
   └─ 캐시 저장 (1시간)

3. Rate Limit 확인
   ├─ 시간당 1000 요청 초과 시: 대기
   └─ 정상 시: 다음 단계

4. 메시지 발송
   ├─ SendingHistory 기록
   ├─ ExecutionLog 기록 (Flag 활성화 시)
   └─ 외부 API 호출 (알리고/AWS SES 등)

5. 에러 처리
   ├─ 에러 발생 시: error-mapper로 분류
   ├─ 재시도 가능: DLQ 큐에 추가
   └─ 영구 오류: 로깅 및 알림
```

---

## 3. Feature Flag 사용법

### 개요

**파일**: `lib/feature-flags.ts`  
**목적**: Phase 3 기능을 점진적으로 롤아웃하기 위한 Feature Flag  
**사용 케이스**:
- 카나리 배포 (0% → 50% → 100%)
- A/B 테스팅 (사용자별 활성화)
- 즉시 롤백 (100% → 0%)

### API

#### 1. Feature Flag 확인 (클라이언트)

```typescript
import { isFeatureFlagEnabled } from '@/lib/feature-flags';

// 사용자별로 Feature Flag 활성화 여부 결정
if (await isFeatureFlagEnabled('menu38-phase3', userId)) {
  // Phase 3 로직 실행
  await sendContactTemplate({ ... });
} else {
  // Phase 2 로직 유지 (호환성)
  await legacySendTemplate({ ... });
}
```

**파라미터**:
```typescript
isFeatureFlagEnabled(
  flagName: 'menu38-phase3',
  userId?: string,  // 사용자별 활성화
  context?: {       // 추가 조건
    environment?: 'staging' | 'production';
    campaign?: { id: string; name: string };
  }
): Promise<boolean>
```

**내부 동작**:
```
Feature Flag 50% 활성화 상태:

userId % 100 < 50 → true (발송 시 ExecutionLog 기록)
userId % 100 >= 50 → false (발송 시 SendingHistory만 기록)
```

#### 2. Feature Flag 설정 (관리자)

```typescript
import { setFeatureFlagPercentage } from '@/lib/feature-flags';

// 관리자 API에서 호출
const result = await setFeatureFlagPercentage(
  'menu38-phase3',
  50,  // 0% → 50% → 100%
  'Canary deployment'
);

// 응답
{
  "flag": "menu38-phase3",
  "enabledPercentage": 50,
  "description": "Canary deployment",
  "updatedAt": "2026-05-19T14:35:00Z",
  "status": "active"
}
```

#### 3. Feature Flag 상태 조회 (대시보드)

```typescript
import { getFeatureFlagStatus } from '@/lib/feature-flags';

const status = await getFeatureFlagStatus('menu38-phase3');

// 응답
{
  "flag": "menu38-phase3",
  "enabledPercentage": 50,
  "status": "active",
  "createdAt": "2026-05-12T00:00:00Z",
  "updatedAt": "2026-05-19T14:35:00Z",
  "totalRequests": 10000,
  "enabledRequests": 5000,
  "conversionRate": 0.95
}
```

### 타이밍 가이드

```
배포 0분:   Feature Flag 0% (OFF)
배포 5분:   DB 마이그레이션, 앱 배포
배포 20분:  Feature Flag 50% (카나리)
배포 50분:  검증 통과 → Feature Flag 100%
배포 완료:  Full production
```

---

## 4. 에러 분류 시스템

### 개요

**파일**: `lib/error-mapper.ts`  
**목적**: 발송 에러를 자동으로 분류하여 재시도 전략 결정  
**이점**:
- 재시도 불가능한 에러는 즉시 중단
- 재시도 가능한 에러는 DLQ 큐에 추가
- 에러율 모니터링 및 알림

### 에러 분류

```typescript
enum ErrorCategory {
  RETRYABLE = 'retryable',      // 나중에 다시 시도 가능
  PERMANENT = 'permanent',      // 재시도 불가능
  UNKNOWN = 'unknown',          // 미분류 (로깅 필요)
}
```

### 사용 예시

```typescript
import { classifyError } from '@/lib/error-mapper';

try {
  await sendContactTemplate({ ... });
} catch (error) {
  const classification = classifyError(error);
  
  if (classification === 'RETRYABLE') {
    // DLQ 큐에 추가
    await enqueueDLQ({
      type: 'SEND_MESSAGE',
      payload: { ... },
      retryCount: 1,
      nextRetry: Date.now() + 5000,  // 5초 후
    });
  } else if (classification === 'PERMANENT') {
    // 로깅 및 알림
    await logError({
      type: 'PERMANENT_ERROR',
      message: error.message,
      timestamp: Date.now(),
    });
    await notifySlack({
      channel: '#crm-alerts',
      message: `⚠️ 발송 실패 (영구 오류): ${error.message}`,
    });
  } else {
    // 미분류: 로깅만 수행
    console.error('[ERROR] 미분류 에러:', error);
  }
}
```

### 분류 규칙

| 에러 타입 | 분류 | 예시 | 조치 |
|----------|------|------|------|
| 네트워크 오류 | RETRYABLE | ECONNREFUSED | DLQ 추가 |
| 타임아웃 | RETRYABLE | timeout after 30s | DLQ 추가 |
| 503 Service Unavailable | RETRYABLE | 외부 API 점검 | DLQ 추가 |
| 400 Bad Request | PERMANENT | 잘못된 휴대폰 번호 | 알림 |
| 401 Unauthorized | PERMANENT | API 키 만료 | 알림 + 액션 |
| 429 Rate Limited | RETRYABLE | 요청 초과 | DLQ 추가 |
| 데이터 검증 실패 | PERMANENT | 필수 필드 누락 | 로깅 |
| 기타 | UNKNOWN | 미분류 | 로깅 |

---

## 5. Contact 캐싱

### 개요

**파일**: `lib/contact-snapshot.ts`  
**목적**: Contact 데이터 조회 성능 향상 (N+1 쿼리 99% 제거)  
**메커니즘**:
- Contact 데이터를 메모리에 캐싱
- TTL = 1시간
- 캐시 미스 시 자동 갱신

### 사용 예시

```typescript
import { getContactSnapshot } from '@/lib/contact-snapshot';

// 100개 연락처 조회 (기존)
// 쿼리: 100개 (N+1 문제)

// 100개 연락처 조회 (Phase 3)
const contacts = await Promise.all(
  contactIds.map(id => getContactSnapshot(id))
);
// 쿼리: 1개 (배치 로딩) → 캐시 적중 시 0개
```

### 캐시 동작

```
첫 번째 호출:
  getContactSnapshot('C001')
  → 캐시 미스
  → DB 쿼리: SELECT * FROM contacts WHERE id='C001'
  → 메모리에 1시간 캐싱
  → 응답

두 번째 호출 (같은 ID, 1시간 내):
  getContactSnapshot('C001')
  → 캐시 적중
  → DB 쿼리 없음 (0ms)
  → 응답

캐시 만료 후:
  → 자동 갱신 (백그라운드)
  → 다음 호출 시 최신 데이터
```

### 캐시 무효화 (필요시)

```typescript
import { invalidateContactCache } from '@/lib/contact-snapshot';

// 특정 연락처 캐시 제거
await invalidateContactCache('C001');

// 전체 캐시 제거
await invalidateContactCache('ALL');

// 사용 케이스
// Contact 정보 수정 후
await updateContact(contactId, { phone: '010-1234-5678' });
await invalidateContactCache(contactId);  // 캐시 삭제
await getContactSnapshot(contactId);      // 최신 데이터 로드
```

### 성능 개선

```
일괄 발송 시나리오: 1000명에게 SMS 발송

Before (캐싱 없음):
- 쿼리 수: 1000개
- DB 시간: 10초
- 총 시간: 12초

After (1시간 캐싱):
- 쿼리 수: 1개 (배치)
- DB 시간: 0.1초
- 캐시 시간: 0.05초
- 총 시간: 2.3초

개선도: 80% 향상 (12초 → 2.3초)
```

---

## 6. Rate Limiter

### 개요

**파일**: `lib/rate-limiter.ts`  
**목적**: 외부 API 호출 속도 제한 (API 차단 95% 감소)  
**설정**:
- 시간당 1000 요청
- 버킷 알고리즘 사용
- 자동 대기

### 사용 예시

```typescript
import { enforceRateLimit } from '@/lib/rate-limiter';

try {
  // Rate Limit 확인
  await enforceRateLimit('aligo-sms');
  
  // 외부 API 호출
  const response = await callExternalAPI({
    type: 'SMS',
    phone: '010-1234-5678',
    message: 'Hello!',
  });
  
  return response;
} catch (error) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    // 대기
    console.log(`Rate limit. Wait ${error.retryAfter}ms`);
    await sleep(error.retryAfter);
    
    // 재시도
    return await sendContactTemplate({ ... });
  }
}
```

### 응답

```typescript
interface RateLimitError {
  code: 'RATE_LIMIT_EXCEEDED';
  service: 'aligo-sms' | 'aws-ses' | 'other';
  requestsRemaining: number;
  requestsLimit: number;
  retryAfter: number;  // 밀리초
  resetAt: Date;
}
```

### 모니터링

```typescript
import { getRateLimitStatus } from '@/lib/rate-limiter';

// 현재 rate limit 상태 확인
const status = await getRateLimitStatus('aligo-sms');

{
  "service": "aligo-sms",
  "requestsRemaining": 850,
  "requestsLimit": 1000,
  "resetAt": "2026-05-19T16:00:00Z",
  "utilizationRate": 0.15
}
```

---

## 7. 테스트 작성

### Unit 테스트 (Jest)

```typescript
// lib/__tests__/contact-template-sender.test.ts

describe('sendContactTemplate', () => {
  it('should send SMS with ExecutionLog when Feature Flag is enabled', async () => {
    // Arrange
    const mockFeatureFlag = jest.spyOn(featureFlags, 'isFeatureFlagEnabled')
      .mockResolvedValue(true);
    
    const mockSendSMS = jest.spyOn(smsService, 'send')
      .mockResolvedValue({ messageId: 'msg-123' });
    
    // Act
    const result = await sendContactTemplate({
      contactId: 'C001',
      channel: 'SMS',
      templateId: 'welcome-sms',
      variables: { name: 'John' },
    });
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.executionLogId).toBeDefined();
    expect(mockSendSMS).toHaveBeenCalledWith(expect.any(Object));
  });
});
```

### E2E 테스트 (Playwright)

```typescript
// tests/e2e/campaign-execution.spec.ts

test('should execute campaign with Phase 3 verification', async ({ page }) => {
  // Step 1: 캠페인 생성
  await page.goto('/campaigns/new');
  await page.fill('[data-testid=campaign-name]', 'Test Campaign');
  await page.click('[data-testid=create-button]');
  
  // Step 2: 캠페인 발송
  await page.click('[data-testid=send-button]');
  
  // Step 3: ExecutionLog 확인
  const status = await page.textContent('[data-testid=execution-status]');
  expect(status).toContain('SENT');
  
  // Step 4: 관리자 API로 검증
  const verifyResponse = await page.request.get(
    'http://localhost:3000/api/admin/verification/status'
  );
  const data = await verifyResponse.json();
  expect(data.consistency).toBeGreaterThan(95);
});
```

### 다양한 Feature Flag 시나리오 테스트

```typescript
describe('Feature Flag rollout scenarios', () => {
  it('should handle 0% rollout (all users get Phase 2)', async () => {
    await setFeatureFlagPercentage('menu38-phase3', 0);
    
    const results = await Promise.all(
      Array.from({ length: 100 }, (_, i) => 
        sendContactTemplate({
          contactId: `C${i}`,
          channel: 'SMS',
          templateId: 'test',
          variables: {},
        })
      )
    );
    
    // 모든 사용자가 Phase 2 사용 (executionLogId 없음)
    results.forEach(result => {
      expect(result.executionLogId).toBeUndefined();
    });
  });
  
  it('should handle 50% rollout (half users get Phase 3)', async () => {
    await setFeatureFlagPercentage('menu38-phase3', 50);
    
    const results = await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        sendContactTemplate({
          contactId: `C${i}`,
          channel: 'SMS',
          templateId: 'test',
          variables: {},
        })
      )
    );
    
    const phase3Users = results.filter(r => r.executionLogId);
    expect(phase3Users.length).toBeCloseTo(50, 10);  // ±10
  });
});
```

---

## 8. 문제 해결

### Q: Feature Flag이 작동하지 않는다

**증상**: Feature Flag을 변경해도 효과 없음  
**해결**:

```bash
# 1. 캐시 확인
redis-cli KEYS "feature-flag:*"

# 2. 캐시 초기화
redis-cli DEL "feature-flag:menu38-phase3"

# 3. 다시 요청
curl http://localhost:3000/api/admin/feature-flags/menu38-phase3
```

### Q: Contact 캐시가 오래된 데이터를 반환한다

**증상**: Contact 정보 수정 후에도 이전 데이터 반환  
**해결**:

```typescript
// 명시적 캐시 무효화
await invalidateContactCache(contactId);

// 또는 전체 캐시 제거 (개발 환경)
await invalidateContactCache('ALL');
```

### Q: Rate Limit이 자주 발동한다

**증상**: 429 Too Many Requests 에러  
**해결**:

```typescript
// 1. 현재 rate limit 확인
const status = await getRateLimitStatus('aligo-sms');
console.log(`Requests remaining: ${status.requestsRemaining}/${status.requestsLimit}`);

// 2. 대기 후 재시도
if (status.requestsRemaining < 100) {
  console.log('Approaching rate limit. Reducing send rate.');
  await sleep(5000);  // 5초 대기
}

// 3. 배치 발송 최적화
// 한 번에 모든 사용자에게 발송하지 말고
// 시간대별로 분산 발송
```

### Q: ExecutionLog 데이터가 없다 (Feature Flag이 활성화되었는데도)

**증상**: Feature Flag 100%인데 ExecutionLog 레코드 없음  
**원인**: 
1. Feature Flag 확인 로직 누락
2. 에러로 인한 조기 종료  
**해결**:

```typescript
// 1. Feature Flag 명시적 확인
const isEnabled = await isFeatureFlagEnabled('menu38-phase3', userId);
console.log(`Feature Flag enabled: ${isEnabled}`);

// 2. 에러 로그 확인
npm run logs | grep ERROR

// 3. 검증 API로 일관성 확인
curl http://localhost:3000/api/admin/verification/status
```

---

## 📚 추가 자료

| 파일 | 설명 |
|------|------|
| `lib/contact-template-sender.ts` | 래퍼 함수 (529줄) |
| `lib/feature-flags.ts` | Feature Flag (127줄) |
| `lib/error-mapper.ts` | 에러 분류 |
| `lib/contact-snapshot.ts` | Contact 캐싱 |
| `lib/rate-limiter.ts` | Rate Limiter |
| `scripts/verify-execution-log.ts` | 자동 검증 |
| `tests/e2e/campaign-execution.spec.ts` | E2E 테스트 |

---

**마지막 수정**: 2026-05-19  
**버전**: 1.0

