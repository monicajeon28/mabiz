# ReCAPTCHA 웹훅 - 빠른 참고 카드

## 엔드포인트
```
POST /api/internal/verify-recaptcha
```

---

## 요청 형식

```bash
curl -X POST http://localhost:3000/api/internal/verify-recaptcha \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "string",
    "contactId": "string",
    "groupId": "string",
    "recaptchaToken": "string",
    "callbackUrl": "string (optional)"
  }'
```

---

## 응답

### 성공 (200 OK)
```json
{
  "ok": true,
  "verificationStatus": "SUCCESS | BLOCKED | FAILED",
  "score": 0.0,
  "verificationId": "rec_..."
}
```

### 에러 (400/401/500)
```json
{
  "ok": false,
  "error": "INVALID_SIGNATURE | INVALID_PAYLOAD | SERVER_ERROR",
  "details": "string",
  "statusCode": 400
}
```

---

## verificationStatus 값

| 값 | 의미 | HTTP | Contact 상태 |
|-----|------|------|-------------|
| `SUCCESS` | 검증 성공 (점수 >= 0.5) | 200 | 유지 (LEAD) |
| `BLOCKED` | 봇 차단 (점수 < 0.5) | 200 | `BLOCKED_BOT` |
| `FAILED` | API 오류 (재시도 예정) | 200 | 유지 |
| (에러) | 필수 필드 누락 | 400 | 미변경 |
| (에러) | 서명 검증 실패 | 401 | 미변경 |
| (에러) | 서버 오류 | 500 | 미변경 |

---

## 환경변수

| 변수 | 필수 | 기본값 | 예시 |
|------|------|--------|------|
| `RECAPTCHA_SECRET_KEY` | ✅ | - | `6LeIxAc...` |
| `RECAPTCHA_SCORE_THRESHOLD` | - | 0.5 | 0.5 |
| `QSTASH_TOKEN` | ✅ | - | `eyJhbGc...` |
| `QSTASH_CURRENT_SIGNING_KEY` | ✅ | - | (자동) |
| `NODE_ENV` | - | development | production |

---

## 점수 해석

| 범위 | 의미 | 결정 |
|------|------|------|
| 0.9~1.0 | 확실한 사람 | `SUCCESS` ✅ |
| 0.7~0.9 | 대부분 정상 | `SUCCESS` ✅ |
| **0.5~0.7** | **중립** | **SUCCESS ✅** |
| 0.3~0.5 | 봇 의심 | `BLOCKED` ❌ |
| 0.0~0.3 | 거의 확실한 봇 | `BLOCKED` ❌ |

---

## 흐름도 (텍스트)

```
요청
 ↓
[1] QStash 서명 검증
 ├─ 프로덕션: X-Qstash-Signature 필수
 └─ 개발: 생략
 ↓
[2] 필수 필드 검증
 ├─ organizationId, contactId, groupId, recaptchaToken
 └─ 누락 → 400 Bad Request
 ↓
[3] Google API 호출
 ├─ POST https://www.google.com/recaptcha/api/siteverify
 ├─ timeout: 5초
 └─ 오류 → score = 0, status = FAILED
 ↓
[4] 점수 판정
 ├─ score >= 0.5 → SUCCESS
 ├─ score < 0.5 → BLOCKED
 └─ API 오류 → FAILED
 ↓
[5] DB 저장
 └─ RecaptchaVerification.create()
 ↓
[6] 상태별 콜백
 ├─ SUCCESS: 로깅만
 ├─ BLOCKED: Contact type 업데이트
 └─ FAILED: 로깅만 (QStash 재시도)
 ↓
응답 (200 OK)
```

---

## 테스트 3가지 방법

### 1. curl (기본)
```bash
curl -X POST http://localhost:3000/api/internal/verify-recaptcha \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"test","contactId":"test","groupId":"test","recaptchaToken":"test"}'
```

### 2. bash 스크립트
```bash
./scripts/test-recaptcha-webhook.sh dev
```

### 3. Postman
```
Method: POST
URL: http://localhost:3000/api/internal/verify-recaptcha
Headers: Content-Type: application/json
Body: {
  "organizationId": "test",
  "contactId": "test",
  "groupId": "test",
  "recaptchaToken": "test"
}
```

---

## 문제 해결 (빠른 진단)

| 증상 | 원인 | 해결 |
|------|------|------|
| 400 Bad Request | 필수 필드 누락 | JSON 필드 확인 |
| 401 Unauthorized | 서명 검증 실패 | QSTASH_CURRENT_SIGNING_KEY 확인 |
| 500 Server Error | RECAPTCHA_SECRET_KEY 미설정 | 환경변수 설정 |
| FAILED 상태 반복 | Google API 오류 | Google 상태 확인, QStash 재시도 대기 |
| BLOCKED 상태 | 점수 < 0.5 | Contact type 확인 (BLOCKED_BOT) |

---

## DB 쿼리 (3개)

### 최근 검증 현황
```sql
SELECT verificationStatus, COUNT(*) as count, AVG(recaptchaScore) as avg_score
FROM "RecaptchaVerification"
WHERE createdAt > NOW() - INTERVAL '24 hours'
GROUP BY verificationStatus;
```

### 차단된 Contact 확인
```sql
SELECT id, email, adminMemo, updatedAt
FROM "Contact"
WHERE type = 'BLOCKED_BOT'
ORDER BY updatedAt DESC LIMIT 20;
```

### 검증 상세 정보
```sql
SELECT rv.*, c.email, c.name
FROM "RecaptchaVerification" rv
LEFT JOIN "Contact" c ON rv.contactId = c.id
WHERE rv.organizationId = '<ORG_ID>'
ORDER BY rv.createdAt DESC LIMIT 50;
```

---

## 로깅 예시

### SUCCESS (정상)
```
[LOG] [VerifyRecaptcha:SUCCESS] 검증 성공 {
  contactId: 'contact-abc',
  groupId: 'group-xyz',
  score: 0.95
}
```

### BLOCKED (봇)
```
[WARN] [VerifyRecaptcha:BLOCKED] 봇 차단 {
  contactId: 'contact-bot',
  groupId: 'group-xyz',
  score: 0.15
}
[LOG] [VerifyRecaptcha:BLOCKED] Contact 업데이트 완료 {
  contactId: 'contact-bot',
  newType: 'BLOCKED_BOT'
}
```

### FAILED (오류)
```
[ERROR] [VerifyRecaptcha] Google API 타임아웃 (5초)
[LOG] [VerifyRecaptcha:FAILED] Google API 검증 실패 {
  contactId: 'contact-error',
  groupId: 'group-xyz'
}
```

---

## 배포 체크리스트 (5단계)

- [ ] Google ReCAPTCHA 생성 (Google Cloud Console)
- [ ] RECAPTCHA_SECRET_KEY 설정 (Vercel Env Vars)
- [ ] QSTASH_TOKEN 설정 (Vercel Env Vars)
- [ ] QStash 토픽 생성: `recaptcha-verification`
- [ ] git push → Vercel 배포

---

## 보안 체크리스트 (3개)

- [ ] Secret Key는 .gitignore에 추가
- [ ] 응답에 Secret Key 포함하지 않기
- [ ] 로그에 전체 Secret Key 출력하지 않기

---

## 파일 경로

| 항목 | 경로 |
|------|------|
| 엔드포인트 | `src/app/api/internal/verify-recaptcha/route.ts` |
| 큐 | `src/lib/recaptcha-queue.ts` |
| 스키마 | `prisma/schema.prisma` (line 4242~4266) |
| 구현 가이드 | `docs/RECAPTCHA_WEBHOOK_IMPLEMENTATION.md` |
| 환경변수 | `docs/RECAPTCHA_ENV_CHECKLIST.md` |
| 통합 가이드 | `docs/RECAPTCHA_INTEGRATION_GUIDE.md` |

---

## 주요 링크

- Google ReCAPTCHA: https://console.cloud.google.com/security/recaptcha
- Upstash QStash: https://console.upstash.com
- Vercel Dashboard: https://vercel.com/dashboard
- Google ReCAPTCHA Docs: https://developers.google.com/recaptcha/docs/v3

---

**빠른 참고용 카드입니다. 자세한 내용은 전체 가이드 문서를 참조하세요.**

**최종 수정:** 2026-05-17
