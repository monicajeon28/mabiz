# ReCAPTCHA 검증 웹훅 구현 (QStash)

## 개요

**엔드포인트:** `POST /api/internal/verify-recaptcha`

ReCAPTCHA v3 토큰을 비동기로 검증하는 QStash 웹훅 핸들러입니다. 그룹 등록 시 Contact/GroupMember를 먼저 생성한 후, 백그라운드에서 ReCAPTCHA 검증을 수행합니다.

---

## 아키텍처

```
Client (Form)
    ↓
    ├─ 그룹 등록 API
    │  └─ Contact + GroupMember 생성 (동기)
    │  └─ ReCAPTCHA 토큰 → QStash 큐에 등록
    │     (enqueueRecaptchaVerification)
    │
    └─ QStash (비동기 처리)
       └─ /api/internal/verify-recaptcha
          ├─ 서명 검증
          ├─ Google API 호출
          ├─ DB에 결과 저장
          └─ 차단된 경우 Contact 상태 업데이트
```

---

## 구현 상세

### 1. QStash 서명 검증

```typescript
function verifyQStashSignature(signature: string | null, body: string): boolean
```

**형식:** `X-Qstash-Signature: {HMAC_SHA256_HEX}.{HMAC_SHA256_BASE64}`

**검증 방식:**
- HMAC-SHA256 + Base64
- `QSTASH_CURRENT_SIGNING_KEY` 환경변수 (Vercel 자동 제공)
- 타이밍 안전 비교 (timing-safe equal)

**개발 환경:** 서명 검증 생략 (NODE_ENV !== 'production')

### 2. Google ReCAPTCHA API 호출

```typescript
async function verifyWithGoogle(recaptchaToken: string): Promise<GoogleRecaptchaResponse | null>
```

**엔드포인트:** `https://www.google.com/recaptcha/api/siteverify` (POST)

**요청:**
```
Content-Type: application/x-www-form-urlencoded
secret={RECAPTCHA_SECRET_KEY}&response={recaptchaToken}
```

**응답:**
```json
{
  "success": true,
  "score": 0.9,
  "action": "submit",
  "challenge_ts": "2026-05-17T10:00:00Z",
  "hostname": "example.com",
  "error_codes": []
}
```

**특징:**
- **타임아웃:** 5초 (AbortController 사용)
- **오류 처리:** null 반환 (로깅만 수행)

### 3. 검증 결과 저장

```typescript
async function saveVerificationResult(
  payload: VerifyRecaptchaPayload,
  googleData: GoogleRecaptchaResponse | null
): Promise<SaveResult>
```

**저장 데이터:**
```prisma
{
  organizationId: string;
  contactId: string;
  groupId: string;
  recaptchaToken: string;
  recaptchaScore: float;
  verificationStatus: 'SUCCESS' | 'BLOCKED' | 'FAILED';
  verifiedAt: DateTime;
  expiresAt: DateTime; // 30일 후
}
```

**상태 결정 로직:**
| 조건 | 상태 | 설명 |
|------|------|------|
| Google API 오류 | `FAILED` | 재시도 필요 |
| `success: false` | `FAILED` | Google이 검증 거부 |
| `score >= 0.5` | `SUCCESS` | 정상 사용자 |
| `score < 0.5` | `BLOCKED` | 봇 의심 |

### 4. 상태별 콜백

#### 4.1 SUCCESS (score >= threshold)
```typescript
async function handleSuccessCase(payload, score): void
```
- Contact 상태 유지
- GroupMember 유지
- 로깅만 수행

#### 4.2 BLOCKED (score < threshold)
```typescript
async function handleBlockedCase(payload, score): void
```
- Contact `type`을 `BLOCKED_BOT`으로 업데이트 (atomic)
- adminMemo에 차단 사유 기록
- 선택: 관리자 알림 이메일 발송

**DB 업데이트:**
```sql
UPDATE "Contact"
SET "type" = 'BLOCKED_BOT',
    "adminMemo" = '[ReCAPTCHA] Bot blocked at 2026-05-17T10:00:00Z (score: 0.15)'
WHERE id = '{contactId}';
```

#### 4.3 FAILED (Google API 오류)
```typescript
async function handleFailedCase(payload): void
```
- 로깅만 수행
- QStash가 자동 재시도 (최대 3회, exponential backoff)

---

## 환경변수

| 변수명 | 필수 | 기본값 | 설명 |
|--------|------|-------|------|
| `RECAPTCHA_SECRET_KEY` | ✅ | - | Google ReCAPTCHA 비밀 키 |
| `RECAPTCHA_SCORE_THRESHOLD` | - | 0.5 | 봇 차단 점수 임계값 (0~1) |
| `QSTASH_CURRENT_SIGNING_KEY` | ✅ | - | QStash 서명 키 (Vercel 자동) |
| `QSTASH_TOKEN` | ✅ | - | QStash API 토큰 (enqueue용) |
| `NODE_ENV` | - | - | 개발 환경에서 서명 검증 생략 |

### 설정 예시

```bash
# .env.local (개발)
RECAPTCHA_SECRET_KEY=6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
RECAPTCHA_SCORE_THRESHOLD=0.5
QSTASH_TOKEN=eyJhbGc...
QSTASH_CURRENT_SIGNING_KEY=...

# Vercel (프로덕션)
# Environment Variables → Add
# Name: RECAPTCHA_SECRET_KEY
# Value: <Google Console에서 발급받은 키>
```

---

## 흐름도 (Sequence)

```
Client
  |
  +─→ POST /api/groups/[id]/register
      │
      └─→ [1] Contact + GroupMember 생성 (동기)
          │
          └─→ [2] enqueueRecaptchaVerification()
              │   (QStash에 메시지 발행)
              │
              └─→ ✅ 즉시 응답 (Contact 생성 확인)
                  
                  QStash (비동기, ~수초 후)
                  │
                  └─→ POST /api/internal/verify-recaptcha
                      │
                      ├─ [3] QStash 서명 검증
                      ├─ [4] Google API 호출 (5초 timeout)
                      ├─ [5] RecaptchaVerification 저장
                      └─ [6] 상태별 콜백 실행
                         ├─ SUCCESS: 로깅
                         ├─ BLOCKED: Contact type 업데이트
                         └─ FAILED: 재시도 (QStash 자동)
```

---

## 사용 예시

### 1. 클라이언트에서 그룹 등록

```typescript
// pages/groups/register.tsx
const response = await fetch(`/api/groups/${groupId}/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'John Doe',
    phone: '01012345678',
    email: 'john@example.com',
    recaptchaToken: /* Google에서 받은 토큰 */
  }),
});

// 응답: { ok: true, contactId, groupId }
// ⚠️ ReCAPTCHA 검증은 백그라운드에서 수행 중
```

### 2. QStash 큐에 등록

```typescript
// src/lib/recaptcha-queue.ts
import { enqueueRecaptchaVerification } from '@/lib/recaptcha-queue';

const taskId = await enqueueRecaptchaVerification({
  organizationId: 'org-123',
  contactId: 'contact-456',
  groupId: 'group-789',
  recaptchaToken: 'token-from-google',
});

// taskId: 'msg_....' (추적용)
```

### 3. 웹훅 수신 및 검증

```typescript
// src/app/api/internal/verify-recaptcha/route.ts
export async function POST(req: Request) {
  // [1] 서명 검증
  // [2] 페이로드 파싱
  // [3] Google API 호출
  // [4] DB 저장
  // [5] Contact 상태 업데이트
  // [6] 응답 반환
}
```

### 4. 검증 결과 조회

```typescript
// DB에서 직접 조회
const verification = await prisma.recaptchaVerification.findFirst({
  where: {
    contactId: 'contact-456',
  },
  orderBy: { createdAt: 'desc' },
});

console.log(verification);
// {
//   id: 'rec-...',
//   verificationStatus: 'SUCCESS',
//   recaptchaScore: 0.9,
//   verifiedAt: 2026-05-17T10:00:00Z,
// }
```

---

## 에러 처리

### 예상되는 에러

#### 1. QStash 서명 검증 실패
```json
{
  "ok": false,
  "error": "INVALID_SIGNATURE",
  "statusCode": 401
}
```
**원인:** 서명이 일치하지 않음 (변조 의심)
**대응:** 모든 요청 거부

#### 2. 필수 필드 누락
```json
{
  "ok": false,
  "error": "INVALID_PAYLOAD",
  "details": "organizationId, contactId, groupId, recaptchaToken 필수",
  "statusCode": 400
}
```
**원인:** 페이로드 형식 오류
**대응:** Contact는 유지, 검증 결과 저장 안 함

#### 3. Google API 오류
```json
{
  "ok": true,
  "verificationStatus": "FAILED",
  "score": 0,
  "statusCode": 200
}
```
**원인:** Google 응답 오류 또는 타임아웃
**대응:** FAILED 상태 저장, QStash 자동 재시도

#### 4. DB 저장 실패
```json
{
  "ok": false,
  "error": "SERVER_ERROR",
  "details": "...",
  "statusCode": 500
}
```
**원인:** Prisma 또는 DB 연결 오류
**대응:** 에러 로깅, QStash 자동 재시도

---

## 보안 고려사항

### 1. 서명 검증 (Production only)
- QStash 서명이 없으면 401 반환
- 개발 환경(NODE_ENV !== 'production')에서는 생략
- 타이밍 안전 비교로 timing attack 방지

### 2. 타임아웃 설정
- Google API: 5초
- Vercel 함수: 60초 (maxDuration)
- QStash 타임아웃: 최대 재시도 3회

### 3. Race Condition 방지
- Contact 업데이트: `where { id }` (unique)
- RecaptchaVerification 생성: `createMany` 사용 (멱등성)

### 4. 로깅 및 감시
- 모든 검증 시도 로깅
- Contact별 차단 사유 기록
- Google API 오류 추적

---

## 테스트

### 1. 로컬 테스트 (curl)

```bash
# 기본 요청
curl -X POST http://localhost:3000/api/internal/verify-recaptcha \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "test-org",
    "contactId": "test-contact",
    "groupId": "test-group",
    "recaptchaToken": "test-token"
  }'

# 예상 응답 (Google API 오류)
# {
#   "ok": true,
#   "verificationStatus": "FAILED",
#   "score": 0
# }
```

### 2. QStash 시뮬레이션

```bash
# QStash CLI 설치
npm install -g qstash

# QStash 토픽에 메시지 발행
qstash publish \
  --topic recaptcha-verification \
  http://localhost:3000/api/internal/verify-recaptcha \
  '{
    "organizationId": "org-123",
    "contactId": "contact-456",
    "groupId": "group-789",
    "recaptchaToken": "token-xyz"
  }'
```

### 3. 통합 테스트

```bash
# 전체 흐름 테스트
./scripts/test-recaptcha-webhook.sh dev
```

---

## 모니터링 및 운영

### 1. 로그 확인

```bash
# 검증 성공
[2026-05-17T10:00:00Z] [LOG] [VerifyRecaptcha:SUCCESS] 검증 성공
  {
    "contactId": "contact-456",
    "groupId": "group-789",
    "score": 0.9
  }

# 봇 차단
[2026-05-17T10:00:01Z] [WARN] [VerifyRecaptcha:BLOCKED] 봇 차단
  {
    "contactId": "contact-999",
    "groupId": "group-789",
    "score": 0.15
  }

# API 오류
[2026-05-17T10:00:02Z] [ERROR] [VerifyRecaptcha] Google API 타임아웃 (5초)
```

### 2. DB 쿼리

```sql
-- 최근 검증 현황
SELECT 
  verificationStatus,
  COUNT(*) as count,
  AVG(recaptchaScore) as avg_score
FROM "RecaptchaVerification"
WHERE createdAt > NOW() - INTERVAL '7 days'
GROUP BY verificationStatus;

-- 차단된 Contact 확인
SELECT id, email, adminMemo, createdAt
FROM "Contact"
WHERE type = 'BLOCKED_BOT'
ORDER BY createdAt DESC
LIMIT 20;
```

### 3. 메트릭

- **검증 성공률:** (SUCCESS / 전체) × 100
- **봇 차단률:** (BLOCKED / 전체) × 100
- **API 오류율:** (FAILED / 전체) × 100
- **평균 점수:** AVG(recaptchaScore)
- **QStash 재시도 횟수:** QStash Dashboard 확인

---

## 주의사항

### 1. RECAPTCHA_SECRET_KEY 노출 금지
- ✅ `.env.local` (로컬 개발)
- ✅ Vercel Environment Variables (프로덕션)
- ❌ 커밋 금지
- ❌ 응답에 포함 금지

### 2. Contact 상태 변경 주의
- `BLOCKED_BOT` 상태가 되면 메시징 대상에서 제외됨
- 관리자가 수동으로 해제 가능
- 별도 알림 이메일 고려

### 3. QStash 토픽 설정
```typescript
// src/lib/recaptcha-queue.ts
const response = await qstash.publishJSON({
  topic: 'recaptcha-verification', // Topic 이름 고정
  body: payload,
  headers: { 'Content-Type': 'application/json' },
  // ⚠️ Vercel Dashboard → QStash → Topics에서
  //    재시도 정책 설정 (최대 3회, exponential backoff)
});
```

### 4. 스키마 변경 금지
```prisma
model RecaptchaVerification {
  id                  String @id @default(cuid())
  organizationId      String
  contactId           String?
  groupId             String?
  recaptchaToken      String
  recaptchaScore      Float
  verificationStatus  RecaptchaVerificationStatus @default(PENDING)
  verifiedAt          DateTime?
  expiresAt           DateTime // 30일 보관
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  // ⚠️ 필드 추가/삭제 시 마이그레이션 필요
}
```

---

## FAQ

### Q1. Contact가 생성되었는데 검증이 BLOCKED인 경우?
**A:** Contact는 유지되지만 type이 'BLOCKED_BOT'로 변경됩니다. 그룹에는 포함되어 있으나 메시징 대상에서 제외됩니다.

### Q2. Google API가 5초 이상 걸리면?
**A:** timeout 발생, FAILED 상태로 저장, QStash가 자동 재시도 (최대 3회)

### Q3. RECAPTCHA_SECRET_KEY 변경 후에는?
**A:** 기존 토큰은 검증 불가능. 환경변수 적용 후 새로운 토큰부터 정상 작동.

### Q4. GroupMember는 언제 삭제되는가?
**A:** 절대 삭제되지 않습니다. Contact type 변경만 발생. 사용자가 이미 그룹에 가입했으므로.

### Q5. QStash 재시도 정책은?
**A:** 최대 3회 재시도, exponential backoff (1s, 5s, 30s). Vercel Dashboard에서 조정 가능.

---

## 참고 링크

- [Google ReCAPTCHA Documentation](https://developers.google.com/recaptcha/docs/v3)
- [QStash Documentation](https://upstash.com/docs/qstash/overall/getstarted)
- [Upstash Node.js SDK](https://upstash.com/docs/sdk/nodejs/qstash/overview)
- [Prisma Recaptcha Model](D:\mabiz-crm\prisma\schema.prisma#L4242)

---

**최종 수정:** 2026-05-17
**상태:** 구현 완료 ✅
