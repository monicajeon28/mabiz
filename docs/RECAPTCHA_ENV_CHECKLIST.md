# ReCAPTCHA 환경변수 체크리스트

## 필수 환경변수

### 1. RECAPTCHA_SECRET_KEY ✅
**출처:** Google Cloud Console
**위치:** [https://console.cloud.google.com/security/recaptcha](https://console.cloud.google.com/security/recaptcha)

#### 설정 방법

**Step 1: Google Cloud 프로젝트 선택**
```
1. Google Cloud Console 접속
2. 상단에서 프로젝트 선택
3. "mabiz-crm" 또는 해당 프로젝트명 선택
```

**Step 2: reCAPTCHA 설정**
```
1. 상단 검색창에서 "reCAPTCHA" 검색
2. "Create CAPTCHA" 클릭
3. Label: "mabiz-crm-v3"
4. reCAPTCHA type: "reCAPTCHA v3"
5. Domain: mabiz.io, staging.mabiz.io, localhost:3000 추가
6. Create 클릭
```

**Step 3: 키 복사**
```
1. 생성된 reCAPTCHA 항목 클릭
2. Secret key 복사 (비밀키)
3. Site key 복사 (공개키) — 프론트엔드에서 사용
```

#### 로컬 설정 (.env.local)
```bash
RECAPTCHA_SECRET_KEY=6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
```

#### 프로덕션 설정 (Vercel)
```
1. Vercel Dashboard → Settings → Environment Variables
2. Name: RECAPTCHA_SECRET_KEY
3. Value: <Google Cloud에서 복사한 Secret Key>
4. Environments: Production, Preview, Development 모두 체크
5. Save
```

---

### 2. RECAPTCHA_SCORE_THRESHOLD
**기본값:** 0.5
**설명:** ReCAPTCHA 점수 임계값 (0~1)

| 점수 범위 | 의미 | 설정값 |
|-----------|------|--------|
| 0.9~1.0 | 확실한 사람 | - |
| 0.5~0.9 | 일반 사용자 | **✅ 권장: 0.5** |
| 0.0~0.5 | 봇 의심 | - |

#### 설정 방법
```bash
# .env.local (개발)
RECAPTCHA_SCORE_THRESHOLD=0.5

# 봇을 더 엄격하게 차단하려면
RECAPTCHA_SCORE_THRESHOLD=0.6

# 봇을 더 관대하게 처리하려면
RECAPTCHA_SCORE_THRESHOLD=0.4
```

---

### 3. QSTASH_TOKEN ✅
**출처:** Upstash Console
**위치:** [https://console.upstash.com](https://console.upstash.com)

#### 설정 방법

**Step 1: Upstash 프로젝트 확인**
```
1. Upstash Console 접속
2. 좌측 메뉴에서 "QStash" 선택
3. "mabiz-crm" 프로젝트 선택
```

**Step 2: API 토큰 복사**
```
1. 프로젝트 대시보드에서 "Token" 탭
2. "Token" 또는 "API Key" 복사
```

#### 로컬 설정 (.env.local)
```bash
QSTASH_TOKEN=eyJhbGc... # 실제 토큰
```

#### 프로덕션 설정 (Vercel)
```
1. Vercel Dashboard → Settings → Environment Variables
2. Name: QSTASH_TOKEN
3. Value: <Upstash에서 복사한 토큰>
4. Environments: Production, Preview, Development 모두 체크
5. Save
```

---

### 4. QSTASH_CURRENT_SIGNING_KEY ✅
**출처:** Vercel 환경 (자동 제공)
**설명:** QStash 웹훅 서명 검증용 키

#### 동작
```
1. QStash가 웹훅을 발행할 때 자동으로 포함
2. Vercel이 환경변수로 자동 주입
3. X-Qstash-Signature 헤더로 전달됨
4. 로컬 개발: 필요 없음 (개발 환경 서명 검증 생략)
```

#### 확인 방법
```bash
# Vercel에서 확인
1. Vercel Dashboard → Settings → Environment Variables
2. QSTASH_CURRENT_SIGNING_KEY 검색
3. Production, Preview 환경에 설정되어 있는지 확인
```

---

## 선택 환경변수

### NODE_ENV
**기본값:** development
**설명:** 환경 구분

```bash
# 로컬 개발
NODE_ENV=development
# → QStash 서명 검증 생략, Google API 호출

# 스테이징
NODE_ENV=staging
# → QStash 서명 검증 활성화

# 프로덕션
NODE_ENV=production
# → QStash 서명 검증 필수
```

---

## 환경별 최종 설정

### 로컬 개발 (.env.local)
```bash
# ReCAPTCHA
RECAPTCHA_SECRET_KEY=6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
RECAPTCHA_SCORE_THRESHOLD=0.5

# QStash
QSTASH_TOKEN=eyJhbGc...

# Node 환경
NODE_ENV=development
```

### 스테이징 (Vercel)
```
Environment: Preview

RECAPTCHA_SECRET_KEY=<실제 키>
RECAPTCHA_SCORE_THRESHOLD=0.5
QSTASH_TOKEN=<실제 토큰>
QSTASH_CURRENT_SIGNING_KEY=<Vercel 자동 주입>
```

### 프로덕션 (Vercel)
```
Environment: Production

RECAPTCHA_SECRET_KEY=<실제 키>
RECAPTCHA_SCORE_THRESHOLD=0.5
QSTASH_TOKEN=<실제 토큰>
QSTASH_CURRENT_SIGNING_KEY=<Vercel 자동 주입>
```

---

## 검증 및 테스트

### 1. 환경변수 확인

```bash
# .env.local이 제대로 로드되는지 확인
npm run dev

# 로그에서 확인
# [LOG] [VerifyRecaptcha] 수신 { contactId: '...', groupId: '...' }
# → RECAPTCHA_SECRET_KEY가 설정되어 있음
```

### 2. Google API 테스트

```bash
# curl로 Google API 직접 호출
curl -X POST https://www.google.com/recaptcha/api/siteverify \
  -d "secret=YOUR_SECRET_KEY&response=DUMMY_TOKEN"

# 응답: { "success": false, "score": 0, "error_codes": [...] }
# → RECAPTCHA_SECRET_KEY가 올바름
```

### 3. QStash 연결 테스트

```bash
# Vercel 함수 로그 확인
1. Vercel Dashboard → Functions
2. /api/internal/verify-recaptcha 찾기
3. "Logs" 탭 클릭
4. 최근 로그 확인
   - "QStash 서명 검증 실패" → QSTASH_CURRENT_SIGNING_KEY 문제
   - "수신" 로그 있음 → 연결 정상
```

---

## 문제 해결

### 문제 1: "RECAPTCHA_SECRET_KEY 미설정"
```
ERROR: [VerifyRecaptcha] RECAPTCHA_SECRET_KEY 미설정
```

**해결:**
```bash
# 1. .env.local에 추가
RECAPTCHA_SECRET_KEY=...

# 2. Vercel에도 추가
Vercel Dashboard → Settings → Environment Variables
```

### 문제 2: "QStash 서명 검증 실패"
```
WARN: [VerifyRecaptcha] QStash 서명 검증 실패 [401]
```

**해결:**
```bash
# 1. 프로덕션 환경 확인
NODE_ENV=production

# 2. QSTASH_CURRENT_SIGNING_KEY 확인
Vercel Dashboard → Functions → Logs

# 3. QStash 토픽 설정 확인
Vercel → QStash → Topics → recaptcha-verification
```

### 문제 3: "Google API 타임아웃"
```
ERROR: [VerifyRecaptcha] Google API 타임아웃 (5초)
```

**해결:**
```bash
# 1. 네트워크 연결 확인
ping www.google.com

# 2. 타임아웃 증가 (선택)
# src/app/api/internal/verify-recaptcha/route.ts
const timeout = setTimeout(() => controller.abort(), 10000); // 10초로 변경

# 3. Google API 상태 확인
https://status.cloud.google.com/
```

---

## 보안 주의사항

### ❌ 절대 금지
```bash
# 커밋하면 안 됨
RECAPTCHA_SECRET_KEY=... # Git에 추가 금지
QSTASH_TOKEN=...          # Git에 추가 금지

# 응답에 노출하면 안 됨
return { secretKey: process.env.RECAPTCHA_SECRET_KEY }; // 위험!

# 로그에 전체 출력 금지
console.log(`Secret: ${process.env.RECAPTCHA_SECRET_KEY}`); // 위험!
```

### ✅ 권장
```bash
# .gitignore에 추가
.env.local
.env.*.local

# 로그에는 일부만 표시
logger.log(`Key: ${key.slice(0, 10)}...`);

# 응답에는 포함 금지
return { ok: true, verificationId: '...' }; // 안전
```

---

## Vercel 배포 체크리스트

- [ ] RECAPTCHA_SECRET_KEY 설정 (Production)
- [ ] RECAPTCHA_SECRET_KEY 설정 (Preview)
- [ ] QSTASH_TOKEN 설정 (Production)
- [ ] QSTASH_TOKEN 설정 (Preview)
- [ ] NODE_ENV 확인 (자동 설정)
- [ ] QStash 토픽 생성: `recaptcha-verification`
- [ ] 토픽 재시도 정책: 최대 3회, exponential backoff
- [ ] 엔드포인트 URL: https://mabiz.io/api/internal/verify-recaptcha

---

## Google Cloud 체크리스트

- [ ] reCAPTCHA v3 생성
- [ ] Domain 추가: mabiz.io
- [ ] Domain 추가: staging.mabiz.io
- [ ] Domain 추가: localhost:3000 (개발)
- [ ] Secret Key 복사
- [ ] Site Key 복사 (프론트엔드용)

---

**최종 확인:** 2026-05-17
**상태:** 준비 완료 ✅
