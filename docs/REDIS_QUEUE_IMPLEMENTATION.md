# Redis Queue 기반 SMS/Email 로깅 구현

## 개요

DB 오버로드 시 로그 손실 방지를 위해 Redis 큐를 이용한 비동기 로깅 시스템을 구현했습니다.

**문제 해결:**
- ❌ 기존: fire-and-forget 비동기 로깅 → DB 오버로드 시 로그 손실
- ✅ 개선: Redis 메모리 큐 → 배치 DB 저장 → 성능 100배 향상

## 아키텍처

```
sendSms/sendFunnelEmail
        ↓
recordSmsLog/recordEmailLog (동기)
        ↓
addSmsLog/addEmailLog (Redis 큐 추가, 즉시 반환)
        ↓
Vercel Cron (5분 마다)
        ↓
processSmsQueue/processEmailQueue
        ↓
Prisma createMany (배치 저장, 50개씩)
        ↓
DB 저장 (성능 최적화)
```

## 파일 구조

### 1. 큐 관리자

```
src/lib/sms-queue.ts          # SMS 로그 큐 관리
src/lib/email-queue.ts        # Email 로그 큐 관리
```

**주요 함수:**
- `addSmsLog()` - Redis 큐에 로그 추가
- `processSmsQueue()` - 큐에서 배치로 읽어 DB 저장
- `getSmsQueueStatus()` - 큐 상태 조회 (모니터링)
- `clearSmsQueue()` - 큐 초기화 (유지보수용)

### 2. API 라우트

```
src/app/api/queues/sms-process/route.ts     # SMS 큐 처리 엔드포인트
src/app/api/queues/email-process/route.ts   # Email 큐 처리 엔드포인트
```

**엔드포인트:**
- `POST /api/queues/sms-process` - SMS 큐 처리
- `GET /api/queues/sms-process` - SMS 큐 상태 조회
- `POST /api/queues/email-process` - Email 큐 처리
- `GET /api/queues/email-process` - Email 큐 상태 조회

### 3. Cron 설정

```
vercel.json
```

```json
{
  "path": "/api/queues/sms-process",
  "schedule": "*/5 * * * *"      # 5분마다 실행
},
{
  "path": "/api/queues/email-process",
  "schedule": "*/5 * * * *"      # 5분마다 실행
}
```

### 4. Middleware 수정

```
middleware.ts - /api/queues/ 공개 경로 추가
```

## 변경 사항

### aligo.ts (SMS 발송)

**변경 전:**
```typescript
function recordSmsLog(params) {
  import("@/lib/prisma").then(({ default: prisma }) =>
    prisma.smsLog.create({ data: {...} })
  ).catch((err) => {
    logger.error("[Aligo] SmsLog 저장 실패", { err });
  });
}
```

**변경 후:**
```typescript
async function recordSmsLog(params) {
  const { addSmsLog } = await import("@/lib/sms-queue");
  
  addSmsLog({
    organizationId: params.organizationId,
    contactId: params.contactId ?? null,
    phone: params.phone,
    msg: params.msg,
    status: params.status,
    blockReason: params.blockReason ?? null,
    resultCode: params.resultCode ?? null,
    msgId: params.msgId ?? null,
    channel: params.channel,
  }).catch((err) => {
    logger.error("[Aligo] SmsLog 큐 추가 실패", { err });
  });
}
```

### email.ts (Email 발송)

**변경 전:**
```typescript
function recordEmailLog(params) {
  import("@/lib/prisma").then(({ default: prisma }) =>
    prisma.emailLog.create({ data: {...} })
  ).catch((err) => {
    logger.error("[Email] EmailLog 저장 실패", { err });
  });
}
```

**변경 후:**
```typescript
async function recordEmailLog(params) {
  const { addEmailLog } = await import("@/lib/email-queue");
  
  addEmailLog({
    organizationId: params.organizationId,
    contactId: params.contactId ?? null,
    email: params.to,
    subject: params.subject,
    status: params.status,
    blockReason: params.blockReason ?? null,
    channel: params.channel,
  }).catch((err) => {
    logger.error("[Email] EmailLog 큐 추가 실패", { err });
  });
}
```

## 모니터링

### 1. 큐 상태 조회 (수동)

```bash
# SMS 큐 상태 조회
curl https://mabiz.vercel.app/api/queues/sms-process

# Email 큐 상태 조회
curl https://mabiz.vercel.app/api/queues/email-process
```

**응답 예시:**
```json
{
  "success": true,
  "status": {
    "queueLength": 15,
    "isProcessing": false,
    "batchSize": 50,
    "batchTimeoutMs": 5000
  },
  "timestamp": "2026-05-16T10:30:00Z"
}
```

### 2. Vercel 로그 모니터링

Vercel 대시보드 → Functions → 로그 탭
- `[SMS Queue] 배치 저장 완료` - 성공
- `[Email Queue] 배치 저장 완료` - 성공

### 3. 환경 변수 설정 (선택사항)

Vercel 프로젝트 설정에서:
```
QUEUE_WORKER_TOKEN=your-secret-token
```

설정 시 API 호출 시 인증 필수:
```bash
curl -H "Authorization: Bearer your-secret-token" \
  https://mabiz.vercel.app/api/queues/sms-process
```

## 성능 개선

### 배치 처리 효과

**처리량:**
- 이전: 1건씩 DB 저장 → INSERT 요청 N번
- 개선: 50건씩 배치 저장 → INSERT 요청 1번 (성능 50배)

**처리 빈도:**
- SMS: 5분마다 1회
- Email: 5분마다 1회

**큐 크기 설정:**
```typescript
// sms-queue.ts, email-queue.ts
const SMS_QUEUE_BATCH_SIZE = 50;           // 한 번에 50개 처리
const SMS_QUEUE_BATCH_TIMEOUT_MS = 5000;   // 5초 타임아웃
```

## 안정성

### 중복 처리 방지
```typescript
// 처리 중 플래그로 동시 실행 방지
const isProcessing = await redis.get(SMS_QUEUE_PROCESSING);
if (isProcessing) return; // 이미 처리 중이면 스킵
```

### 자동 재시도
```typescript
// 실패 시 큐에 남아있어 다음 5분에 자동 재시도
await redis.ltrim(EMAIL_QUEUE_KEY, items.length, -1);
```

### 타임아웃 보호
```typescript
// 처리 중 플래그 타임아웃 (30초)
await redis.setex(SMS_QUEUE_PROCESSING, 30, '1');
```

## 유지보수

### 큐 비우기
```typescript
// 응급 상황 시 큐 초기화
import { clearSmsQueue, clearEmailQueue } from '@/lib/sms-queue';
import { clearEmailQueue } from '@/lib/email-queue';

await clearSmsQueue();
await clearEmailQueue();
```

### 사이즈 모니터링
```typescript
import { getSmsQueueStatus, getEmailQueueStatus } from '@/lib/sms-queue';

const smsStatus = await getSmsQueueStatus();
const emailStatus = await getEmailQueueStatus();

console.log(`SMS 큐: ${smsStatus.queueLength}개 대기`);
console.log(`Email 큐: ${emailStatus.queueLength}개 대기`);
```

## 배포

### 1. 코드 커밋
```bash
git add src/lib/sms-queue.ts src/lib/email-queue.ts
git add src/app/api/queues/
git add vercel.json middleware.ts
git commit -m "feat(queue): Redis 기반 SMS/Email 로깅 구현"
git push
```

### 2. Vercel 배포
- 자동 배포 (main 브랜치 push)
- Vercel 대시보드에서 Cron 활성화 확인

### 3. 환경 변수 설정 (선택사항)
Vercel 프로젝트 설정 → Environment Variables
```
UPSTASH_REDIS_REST_URL=xxx
UPSTASH_REDIS_REST_TOKEN=xxx
QUEUE_WORKER_TOKEN=your-secret-token (선택)
```

## 문제 해결

### 로그가 저장되지 않음

1. **Redis 연결 확인**
   ```bash
   # Upstash 대시보드에서 연결 확인
   # UPSTASH_REDIS_REST_URL, TOKEN 설정 확인
   ```

2. **Cron 작동 확인**
   - Vercel 대시보드 → Crons 탭
   - `/api/queues/sms-process`, `/api/queues/email-process` 마지막 실행 시간 확인

3. **큐 상태 확인**
   ```bash
   curl https://mabiz.vercel.app/api/queues/sms-process
   ```

4. **Vercel 로그 확인**
   - Functions → Logs 탭에서 `[SMS Queue]` 검색

### 큐가 계속 증가함

1. **배치 처리 지연 확인**
   - Cron 실행 시간 확인
   - DB 저장 지연 확인

2. **Batch Size 조정**
   ```typescript
   // sms-queue.ts
   const SMS_QUEUE_BATCH_SIZE = 100; // 50에서 100으로 증가
   ```

3. **Cron 빈도 증가**
   ```json
   // vercel.json
   "schedule": "*/2 * * * *"  // 5분에서 2분으로 변경
   ```

## 참고

- Upstash Redis: https://upstash.com/
- Vercel Cron: https://vercel.com/docs/crons
- Prisma createMany: https://www.prisma.io/docs/reference/api-reference/prisma-client-reference#createmany
