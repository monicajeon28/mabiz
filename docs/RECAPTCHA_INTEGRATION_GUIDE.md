# ReCAPTCHA 웹훅 통합 가이드

## 목차
1. [빠른 시작](#빠른-시작)
2. [Google ReCAPTCHA API 호출 (핵심 로직)](#google-recaptcha-api-호출-핵심-로직)
3. [QStash 호출 흐름](#qstash-호출-흐름)
4. [콜백 함수 상세](#콜백-함수-상세)
5. [테스트 시나리오](#테스트-시나리오)
6. [프로덕션 배포](#프로덕션-배포)

---

## 빠른 시작

### 1분 안에 시작하기

```bash
# Step 1: 환경변수 설정
echo "RECAPTCHA_SECRET_KEY=<Google에서 받은 키>" >> .env.local
echo "QSTASH_TOKEN=<Upstash에서 받은 토큰>" >> .env.local

# Step 2: 개발 서버 시작
npm run dev

# Step 3: API 엔드포인트 테스트
curl -X POST http://localhost:3000/api/internal/verify-recaptcha \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "test-org",
    "contactId": "test-contact",
    "groupId": "test-group",
    "recaptchaToken": "test-token"
  }'

# Step 4: 응답 확인 (Google API 오류 예상)
# {
#   "ok": true,
#   "verificationStatus": "FAILED",
#   "score": 0
# }
```

---

## Google ReCAPTCHA API 호출 (핵심 로직)

### API 스펙

**엔드포인트:** `POST https://www.google.com/recaptcha/api/siteverify`

**요청 형식:**
```
Content-Type: application/x-www-form-urlencoded

secret={RECAPTCHA_SECRET_KEY}&response={recaptchaToken}
```

### 구현 코드

```typescript
/**
 * Google ReCAPTCHA v3 검증 (핵심 함수)
 * 
 * 특징:
 * - 비동기 fetch 사용
 * - 5초 타임아웃 (AbortController)
 * - 에러 처리: null 반환
 * - 스코어: 0.0~1.0 (높을수록 정상 사용자)
 */
async function verifyWithGoogle(recaptchaToken: string): Promise<GoogleRecaptchaResponse | null> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    logger.error('[VerifyRecaptcha] RECAPTCHA_SECRET_KEY 미설정');
    return null;
  }

  try {
    // 타임아웃 설정 (5초)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(recaptchaToken)}`,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      logger.error('[VerifyRecaptcha] Google API 오류', {
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    const data = (await response.json()) as GoogleRecaptchaResponse;
    return data;

  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      logger.error('[VerifyRecaptcha] Google API 타임아웃 (5초)');
    } else {
      logger.error('[VerifyRecaptcha] Google API 호출 실패', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return null;
  }
}
```

### Google 응답 예시

**성공 (정상 사용자):**
```json
{
  "success": true,
  "score": 0.95,
  "action": "submit",
  "challenge_ts": "2026-05-17T10:00:00Z",
  "hostname": "mabiz.io"
}
```

**실패 (봇 의심):**
```json
{
  "success": true,
  "score": 0.15,
  "action": "submit",
  "challenge_ts": "2026-05-17T10:00:01Z",
  "hostname": "mabiz.io"
}
```

**오류 (Google API 문제):**
```json
{
  "success": false,
  "error_codes": [
    "invalid-input-secret"
  ]
}
```

### 점수 해석

| 스코어 | 의미 | 권장 동작 |
|--------|------|----------|
| 0.9~1.0 | 거의 확실한 사람 | 통과 |
| 0.7~0.9 | 대부분 정상 | 통과 |
| **0.5~0.7** | 중립 (권장 임계값) | **통과** |
| 0.3~0.5 | 봇 의심 | 검토 또는 차단 |
| 0.0~0.3 | 거의 확실한 봇 | 차단 |

---

## QStash 호출 흐름

### 1단계: 클라이언트 그룹 등록

```typescript
// 그룹 등록 폼 제출
const response = await fetch('/api/groups/{groupId}/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'John Doe',
    phone: '01012345678',
    email: 'john@example.com',
    recaptchaToken: /* Google에서 받은 토큰 */,
  }),
});

const data = await response.json();
console.log('Contact 생성됨:', data.contactId);
console.log('ReCAPTCHA 검증 진행 중 (백그라운드)...');
```

### 2단계: Contact + GroupMember 생성 (동기)

```typescript
// src/app/api/groups/[id]/register/route.ts
export async function POST(req: Request) {
  const body = await req.json();

  // [동기] Contact + GroupMember 생성
  const { contactId, groupId } = await prisma.$transaction(async (tx) => {
    const contact = await tx.contact.create({
      data: {
        phone: normalizePhone(body.phone),
        name: body.name,
        email: body.email,
        organizationId,
      },
    });

    const groupMember = await tx.contactGroupMember.create({
      data: {
        contactId: contact.id,
        groupId,
      },
    });

    return { contactId: contact.id, groupId };
  });

  // [비동기] ReCAPTCHA 검증 큐 등록
  if (body.recaptchaToken) {
    await enqueueRecaptchaVerification({
      organizationId,
      contactId,
      groupId,
      recaptchaToken: body.recaptchaToken,
    });
  }

  // ✅ 즉시 응답 (Contact 생성됨)
  return NextResponse.json({
    ok: true,
    contactId,
    groupId,
  });
}
```

### 3단계: QStash 큐에 메시지 발행

```typescript
// src/lib/recaptcha-queue.ts
export async function enqueueRecaptchaVerification(
  payload: RecaptchaVerificationPayload
): Promise<string> {
  const qstash = new Client({
    token: process.env.QSTASH_TOKEN!,
  });

  const response = await qstash.publishJSON({
    topic: 'recaptcha-verification', // Topic 이름 (Vercel에서 설정)
    body: payload,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  logger.log('[RecaptchaQueue] Enqueued', {
    taskId: response.messageId,
    contactId: payload.contactId,
  });

  return response.messageId as string;
}
```

### 4단계: QStash 웹훅 호출 (수초 후)

```
QStash (비동기)
  ↓
  [자동 재시도 최대 3회 (exponential backoff)]
  ↓
  POST /api/internal/verify-recaptcha
  Headers: {
    'X-Qstash-Signature': '...',
    'Content-Type': 'application/json',
  }
  Body: {
    "organizationId": "...",
    "contactId": "...",
    "groupId": "...",
    "recaptchaToken": "..."
  }
```

### 5단계: 웹훅 응답

```json
{
  "ok": true,
  "verificationStatus": "SUCCESS",
  "score": 0.95,
  "verificationId": "rec_..."
}
```

---

## 콜백 함수 상세

### handleSuccessCase (스코어 >= 임계값)

```typescript
/**
 * 검증 성공: 정상 사용자로 판정
 * 
 * 동작:
 * - Contact 상태 유지 (type: LEAD 유지)
 * - GroupMember 유지 (이미 생성됨)
 * - 로깅만 수행
 */
async function handleSuccessCase(
  payload: VerifyRecaptchaPayload,
  score: number
): Promise<void> {
  const { contactId, groupId } = payload;

  logger.log('[VerifyRecaptcha:SUCCESS] 검증 성공', {
    contactId,
    groupId,
    score, // 예: 0.95
  });

  // 추가 처리 없음
  // Contact는 정상 상태 유지
  // GroupMember는 활성 상태 유지
}

// 예시
// [LOG] [VerifyRecaptcha:SUCCESS] 검증 성공 { contactId: 'contact-abc', score: 0.95 }
```

### handleBlockedCase (스코어 < 임계값)

```typescript
/**
 * 검증 실패: 봇으로 판정
 * 
 * 동작:
 * - Contact type을 'BLOCKED_BOT'으로 변경
 * - adminMemo에 차단 사유 기록
 * - Contact는 유지 (삭제하지 않음)
 * - GroupMember는 유지 (이미 가입했으므로)
 * - 선택: 관리자 알림 이메일 발송
 */
async function handleBlockedCase(
  payload: VerifyRecaptchaPayload,
  score: number
): Promise<void> {
  const { organizationId, contactId } = payload;

  logger.warn('[VerifyRecaptcha:BLOCKED] 봇 차단', {
    contactId,
    score, // 예: 0.15
  });

  try {
    // Atomic 업데이트: Contact type 변경
    const updated = await prisma.contact.update({
      where: { id: contactId },
      data: {
        type: 'BLOCKED_BOT',
        adminMemo: `[ReCAPTCHA] Bot blocked at ${new Date().toISOString()} (score: ${score})`,
      },
    });

    logger.log('[VerifyRecaptcha:BLOCKED] Contact 업데이트 완료', {
      contactId,
      newType: updated.type,
    });

    // 선택: 관리자 알림 (구현 필요)
    // await notifyAdminBotBlocked(organizationId, contactId, score);

  } catch (err) {
    logger.error('[VerifyRecaptcha:BLOCKED] Contact 업데이트 실패', {
      error: err instanceof Error ? err.message : String(err),
      contactId,
    });
  }
}

// 예시
// [WARN] [VerifyRecaptcha:BLOCKED] 봇 차단 { contactId: 'contact-xyz', score: 0.15 }
// [LOG] [VerifyRecaptcha:BLOCKED] Contact 업데이트 완료 { contactId: 'contact-xyz', newType: 'BLOCKED_BOT' }

// DB 결과
// Contact {
//   id: 'contact-xyz',
//   type: 'BLOCKED_BOT',
//   adminMemo: '[ReCAPTCHA] Bot blocked at 2026-05-17T10:00:00Z (score: 0.15)',
//   ...
// }
```

### handleFailedCase (Google API 오류)

```typescript
/**
 * 검증 오류: Google API 실패
 * 
 * 동작:
 * - 로깅만 수행
 * - Contact/GroupMember 수정 없음
 * - QStash가 자동 재시도 (최대 3회)
 * - exponential backoff: 1초 → 5초 → 30초
 */
async function handleFailedCase(
  payload: VerifyRecaptchaPayload
): Promise<void> {
  const { contactId, groupId } = payload;

  logger.error('[VerifyRecaptcha:FAILED] Google API 검증 실패', {
    contactId,
    groupId,
  });

  // 재시도는 QStash가 자동 처리
  // 이 함수는 로깅만 수행
}

// 예시
// [ERROR] [VerifyRecaptcha:FAILED] Google API 검증 실패 { contactId: 'contact-abc', groupId: 'group-xyz' }
// 
// QStash 재시도:
// Attempt 1: 실패 (1초 후 재시도)
// Attempt 2: 실패 (5초 후 재시도)
// Attempt 3: 실패 (30초 후 포기)
// → RecaptchaVerification 상태: FAILED
```

---

## 테스트 시나리오

### 시나리오 1: 정상 사용자 (Success)

```bash
# 1. 실제 Google 토큰 얻기
# 프론트엔드에서 grecaptcha.ready() → grecaptcha.execute('SITE_KEY')
REAL_TOKEN="<Google에서 받은 실제 토큰>"

# 2. 웹훅 호출
curl -X POST http://localhost:3000/api/internal/verify-recaptcha \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "org-success",
    "contactId": "contact-success",
    "groupId": "group-success",
    "recaptchaToken": "'$REAL_TOKEN'"
  }'

# 3. 응답 확인
# {
#   "ok": true,
#   "verificationStatus": "SUCCESS",
#   "score": 0.9,
#   "verificationId": "rec_..."
# }

# 4. DB 확인
# SELECT * FROM "RecaptchaVerification" 
# WHERE contactId = 'contact-success';
# 
# id: rec_...
# verificationStatus: SUCCESS
# recaptchaScore: 0.9
# verifiedAt: 2026-05-17T10:00:00Z
```

### 시나리오 2: 봇 (Blocked)

```bash
# ReCAPTCHA 점수가 낮은 토큰 사용 (또는 조작된 토큰)
INVALID_TOKEN="invalid-token"

curl -X POST http://localhost:3000/api/internal/verify-recaptcha \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "org-blocked",
    "contactId": "contact-bot",
    "groupId": "group-bot",
    "recaptchaToken": "'$INVALID_TOKEN'"
  }'

# 응답
# {
#   "ok": true,
#   "verificationStatus": "BLOCKED",
#   "score": 0.05,
#   "verificationId": "rec_..."
# }

# DB 확인 - Contact 업데이트됨
# SELECT * FROM "Contact" WHERE id = 'contact-bot';
# 
# type: BLOCKED_BOT
# adminMemo: [ReCAPTCHA] Bot blocked at 2026-05-17T10:00:00Z (score: 0.05)
```

### 시나리오 3: API 오류 (Failed)

```bash
# 잘못된 Secret Key로 테스트
WRONG_SECRET="invalid-secret-key"

curl -X POST http://localhost:3000/api/internal/verify-recaptcha \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "org-failed",
    "contactId": "contact-error",
    "groupId": "group-error",
    "recaptchaToken": "any-token"
  }'

# 응답
# {
#   "ok": true,
#   "verificationStatus": "FAILED",
#   "score": 0,
#   "verificationId": "rec_..."
# }

# 로그
# [ERROR] [VerifyRecaptcha] Google API 호출 실패

# DB 확인
# SELECT * FROM "RecaptchaVerification" 
# WHERE contactId = 'contact-error';
# 
# verificationStatus: FAILED
# recaptchaScore: 0
```

### 시나리오 4: 필수 필드 누락

```bash
# contactId 없이 요청
curl -X POST http://localhost:3000/api/internal/verify-recaptcha \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "org-test",
    "groupId": "group-test",
    "recaptchaToken": "token"
  }'

# 응답 (400 Bad Request)
# {
#   "ok": false,
#   "error": "INVALID_PAYLOAD",
#   "details": "organizationId, contactId, groupId, recaptchaToken 필수",
#   "statusCode": 400
# }

# DB: RecaptchaVerification 저장 안 됨
# Contact: 변경 없음
```

### 시나리오 5: QStash 서명 검증 실패 (프로덕션)

```bash
# 잘못된 X-Qstash-Signature 헤더
curl -X POST https://mabiz.io/api/internal/verify-recaptcha \
  -H "Content-Type: application/json" \
  -H "X-Qstash-Signature: invalid.signature" \
  -d '{
    "organizationId": "org-test",
    "contactId": "contact-test",
    "groupId": "group-test",
    "recaptchaToken": "token"
  }'

# 응답 (401 Unauthorized)
# {
#   "ok": false,
#   "error": "INVALID_SIGNATURE",
#   "statusCode": 401
# }

# 로그
# [WARN] [VerifyRecaptcha] QStash 서명 검증 실패

# DB: 저장되지 않음
```

---

## 프로덕션 배포

### Step 1: 환경변수 설정 (Vercel)

```bash
# Vercel Dashboard → Settings → Environment Variables

# Production
RECAPTCHA_SECRET_KEY=<Google에서 받은 SECRET>
RECAPTCHA_SCORE_THRESHOLD=0.5
QSTASH_TOKEN=<Upstash 토큰>
QSTASH_CURRENT_SIGNING_KEY=<자동 설정>

# Preview (스테이징)
RECAPTCHA_SECRET_KEY=<테스트 키>
RECAPTCHA_SCORE_THRESHOLD=0.5
QSTASH_TOKEN=<테스트 토큰>
```

### Step 2: QStash 토픽 설정

```bash
# Vercel 대시보드 → QStash → Topics

# 새 토픽 생성 또는 기존 토픽 사용
Topic Name: recaptcha-verification

# Endpoint 설정
POST https://mabiz.io/api/internal/verify-recaptcha

# 재시도 정책
Max retries: 3
Backoff: exponential (1s, 5s, 30s)
```

### Step 3: 도메인 설정 (Google ReCAPTCHA)

```bash
# Google Cloud Console → reCAPTCHA

# Domains 추가
- mabiz.io
- staging.mabiz.io
- *.mabiz.io (와일드카드)
```

### Step 4: 배포 및 테스트

```bash
# 1. 프로덕션 배포
git push origin main

# 2. 배포 대기
Vercel Dashboard → Deployments → 상태 확인

# 3. 프로덕션 엔드포인트 테스트
curl -X POST https://mabiz.io/api/internal/verify-recaptcha \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"test","contactId":"test","groupId":"test","recaptchaToken":"test"}'

# 4. 함수 로그 확인
Vercel Dashboard → Functions → verify-recaptcha → Logs
```

### Step 5: 모니터링 설정

```bash
# 1. 에러 모니터링 (Sentry, DataDog 등)
# 2. 성능 모니터링 (Google Analytics, Vercel Analytics)
# 3. 로그 확인 (Vercel Logs, CloudWatch)

# 감시할 메트릭:
# - FAILED 상태 비율
# - BLOCKED 상태 비율
# - Google API 평균 응답 시간
# - QStash 재시도 횟수
```

---

## 트러블슈팅

### 문제: "RECAPTCHA_SECRET_KEY 미설정"

```
ERROR: [VerifyRecaptcha] RECAPTCHA_SECRET_KEY 미설정
```

**확인:**
```bash
# 로컬
cat .env.local | grep RECAPTCHA_SECRET_KEY

# Vercel
Vercel Dashboard → Settings → Environment Variables → RECAPTCHA_SECRET_KEY
```

### 문제: "Google API 타임아웃"

```
ERROR: [VerifyRecaptcha] Google API 타임아웃 (5초)
```

**원인:** 네트워크 지연, Google 서버 과부하
**해결:**
- QStash 자동 재시도 대기
- 타임아웃 로그 모니터링
- Google API 상태 확인: https://status.cloud.google.com/

### 문제: "QStash 서명 검증 실패"

```
WARN: [VerifyRecaptcha] QStash 서명 검증 실패 [401]
```

**원인:** QSTASH_CURRENT_SIGNING_KEY 미설정 또는 불일치
**해결:**
```bash
# 1. Vercel 환경변수 확인
Vercel Dashboard → Settings → Environment Variables

# 2. QStash 키 갱신
Vercel → QStash → Re-sync keys

# 3. 로그 확인
Vercel → Functions → verify-recaptcha → Logs
```

---

**최종 수정:** 2026-05-17  
**상태:** 배포 준비 완료 ✅
