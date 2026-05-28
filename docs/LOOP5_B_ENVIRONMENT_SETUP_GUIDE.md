# Loop 5-B: 환경변수 설정 + SMS 테스트 가이드

**담당**: Agent B (환경변수 설정 + SMS 테스트)  
**완료일**: 2026-05-28  
**상태**: ✅ 완성

---

## 🎯 목표

Loop 5 배포 시 필수 환경변수 설정 및 SMS 기능 검증

### 주요 산출물

| 파일 | 용도 | 상태 |
|------|------|------|
| `.env.example` | 환경변수 템플릿 (설명 포함) | ✅ 완성 |
| `.env.local` | 로컬 개발 환경 설정 (실제 값 입력 필요) | ✅ 완성 |
| `scripts/test-loop5-sms.ts` | SMS 전체 테스트 스크립트 | ✅ 완성 |
| `scripts/test-aligo-sms.ts` | Aligo API 단독 테스트 스크립트 | ✅ 완성 |

---

## 📋 필수 환경변수 (4가지)

### 1. Aligo SMS API (필수)

```env
ALIGO_API_KEY="[YOUR_ALIGO_API_KEY]"
ALIGO_USER_ID="[YOUR_ALIGO_USER_ID]"
ALIGO_SENDER_PHONE="[YOUR_SENDER_PHONE]"
```

**설정 방법**:

```
1. Aligo 계정 생성: https://aligo.in
2. 대시보드 로그인
3. 개인정보 > API KEY 복사
4. 발신 번호 승인 (SMS 발송 가능할 때까지 대기)
5. 위 값 .env.local 에 입력
```

**확인**:
```bash
# API 키 유효성 확인
npx ts-node scripts/test-aligo-sms.ts
```

---

### 2. Nodemailer SMTP (선택: Email 기능 필요시)

```env
NODEMAILER_HOST="smtp.gmail.com"
NODEMAILER_PORT="587"
NODEMAILER_USER="your-email@gmail.com"
NODEMAILER_PASS="[YOUR_APP_PASSWORD]"
NODEMAILER_FROM_NAME="마비즈 CRM"
NODEMAILER_FROM_EMAIL="support@mabiz.co.kr"
EMAIL_ENCRYPT_KEY="[32자_이상_난수]"
```

**Gmail 설정 예시**:

```
1. Gmail 계정 2단계 인증 활성화
2. 앱 비밀번호 생성: https://myaccount.google.com/apppasswords
3. 생성된 비밀번호를 NODEMAILER_PASS 에 입력
4. NODEMAILER_HOST: smtp.gmail.com
5. NODEMAILER_PORT: 587
```

**Office365 설정**:

```
NODEMAILER_HOST="smtp.office365.com"
NODEMAILER_PORT="587"
NODEMAILER_USER="your-email@company.com"
NODEMAILER_PASS="[YOUR_PASSWORD]"
```

---

### 3. Cron Secret (필수)

```env
CRON_SECRET="[YOUR_RANDOM_CRON_SECRET]"
```

**생성 방법**:
```bash
# macOS/Linux
openssl rand -hex 32

# Windows PowerShell
[Convert]::ToHexString((Get-Random -InputObject (1..256) -Count 32))
```

**설정 위치**: Vercel 대시보드 > Settings > Environment Variables > **Production 전용**

---

### 4. Webhook Secret (필수)

```env
WEBHOOK_SECRET="[YOUR_WEBHOOK_SECRET]"
WEBHOOK_SECRET_LENGTH="256"
```

**생성 방법**:
```bash
# 256자 이상 난수 생성
openssl rand -hex 128
```

---

## 🚀 설정 단계별 가이드

### Step 1: .env.local 작성 (5분)

```bash
cd D:\mabiz-crm

# .env.example 을 참고하여 .env.local 작성
# (또는 기존 .env.local 에 아래 내용 추가)

cat > .env.local << 'EOF'
# ... 기존 설정 ...

# Aligo SMS API
ALIGO_API_KEY="your_api_key_here"
ALIGO_USER_ID="your_user_id_here"
ALIGO_SENDER_PHONE="01012345678"

# Nodemailer (선택)
NODEMAILER_HOST="smtp.gmail.com"
NODEMAILER_USER="support@mabiz.co.kr"
NODEMAILER_PASS="your_app_password"
EMAIL_ENCRYPT_KEY="your_32_char_key_here"

# Cron
CRON_SECRET="your_cron_secret_here"

# Webhook
WEBHOOK_SECRET="your_webhook_secret_here"
EOF
```

### Step 2: 환경변수 검증 (2분)

```bash
npx ts-node scripts/test-loop5-sms.ts
```

**예상 출력**:
```
═════════════════════════════════════════════════════════════════
🧪 Loop 5-B SMS 자동화 테스트
═════════════════════════════════════════════════════════════════

📋 Step 1: 환경변수 검증

✓ DATABASE_URL
✓ ALIGO_API_KEY
✓ ALIGO_USER_ID
✓ ALIGO_SENDER_PHONE
...

✓ PASS: 10
✗ FAIL: 0
⚠ WARN: 2

✅ 모든 필수 항목이 설정되었습니다!
```

### Step 3: 데이터베이스 마이그레이션 (3분)

```bash
npx prisma migrate deploy
```

**확인**:
```bash
npx prisma studio

# Database 탭에서 FormSubmission 테이블 확인
```

### Step 4: SMS API 테스트 (5분 + 수신 대기)

```bash
# 드라이런 (실제 발송 안 함)
npx ts-node scripts/test-aligo-sms.ts --dry-run

# 또는 실제 발송 테스트
npx ts-node scripts/test-aligo-sms.ts
```

**테스트 번호**: 자신의 휴대폰 번호 사용 권장

### Step 5: 로컬 서버 실행 및 폼 테스트 (3분)

```bash
npm run dev

# 브라우저: http://localhost:3000
# Contact Form 찾기 > 폼 제출
# Prisma Studio 에서 FormSubmission 레코드 확인
```

### Step 6: Vercel 배포 준비 (5분)

```bash
# 빌드 테스트
npm run build

# Git 커밋
git add .env.example docs/LOOP5_B_ENVIRONMENT_SETUP_GUIDE.md
git commit -m "feat(loop5-b): SMS API 환경변수 설정 + 테스트 스크립트"

# 푸시
git push origin main
```

**Vercel 대시보드 설정**:

1. Settings > Environment Variables
2. Production 탭에서 다음 추가:
   - `ALIGO_API_KEY`
   - `ALIGO_USER_ID`
   - `ALIGO_SENDER_PHONE`
   - `NODEMAILER_HOST` (선택)
   - `NODEMAILER_USER` (선택)
   - `NODEMAILER_PASS` (선택)
   - `EMAIL_ENCRYPT_KEY`
   - `CRON_SECRET`
   - `WEBHOOK_SECRET`

3. Redeploy 클릭

---

## 📱 SMS 자동화 시퀀스 (Day 0-3)

### Day 0: 초기 접촉 (즉시)
```
발송 시간: 폼 제출 직후
심리학: PASONA P (Problem) + L6 (손실회피)
내용: "크루즈 여행, 혼자는 너무 외로워요..."
CTR 목표: +35%
```

### Day 1: Follow-up (24시간 후)
```
발송 시간: 2026-05-29 14:00 (발송일 기준)
심리학: PASONA S (Solution) + L3 (차별성)
내용: "마비즈 크루즈: 최고의 가성비..."
CTR 목표: +38%
```

### Day 2: 강조 (48시간 후)
```
발송 시간: 2026-05-30 14:00
심리학: PASONA O (Offer) + L6 (타이밍)
내용: "한정 예약: 이번 달 마지막 6자리만..."
CTR 목표: +52%
```

### Day 3: 결정 (72시간 후)
```
발송 시간: 2026-05-31 14:00
심리학: PASONA N (Now) + L10 (즉시 구매)
내용: "12시간만 더! 특가 종료..."
전환율 목표: +65%
```

---

## 🔧 환경변수별 상세 설명

### ALIGO_API_KEY

```
알리고(Aligo) SMS API 인증 키
- 용도: SMS 발송 요청 검증
- 위치: https://aligo.in > 개인정보 > API KEY
- 형식: 32자 이상 영문+숫자
- 보안: 절대 노출 금지
- 재발급: 대시보드에서 "API KEY 재생성" 클릭
```

**테스트**:
```bash
echo "Aligo API Key test:"
echo $ALIGO_API_KEY | wc -c  # 32자 이상이어야 함
```

### ALIGO_USER_ID

```
알리고 계정 ID (이메일 기반)
- 용도: API 호출 사용자 식별
- 형식: user@domain.com
- 획득: Aligo 가입시 사용한 이메일
```

### ALIGO_SENDER_PHONE

```
SMS 발신 전화번호 (승인된 번호)
- 용도: 수신자에게 표시되는 발신번호
- 형식: 01012345678 (하이픈 제거)
- 주의: 미승인 번호로 발송 시 실패
- 승인: Aligo > 발신번호 관리 > 새 번호 등록 후 대기
```

**확인 방법**:
```sql
-- Prisma Studio > OrgSmsConfig
SELECT "senderPhone" FROM "OrgSmsConfig" LIMIT 1;
```

### EMAIL_ENCRYPT_KEY

```
이메일 비밀번호 암호화 키
- 용도: SMTP 비밀번호를 DB에 암호화 저장
- 크기: 최소 32자 (256bit 권장)
- 형식: 16진수 또는 문자열
- 재설정 불가: 한 번 설정 후 변경하면 기존 암호 복호화 불가
```

**생성**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### CRON_SECRET

```
Vercel Cron Job 보안 토큰
- 용도: /api/cron/* 엔드포인트 보호
- 형식: 복잡한 난수 문자열
- 위치: Vercel > Settings > Environment Variables > Production
- 비고: Development에는 설정 불필요 (localhost는 제한 없음)
```

**검증 구현** (src/lib/cron-auth.ts):
```typescript
export function validateCronSecret(secret: string): boolean {
  const envSecret = process.env.CRON_SECRET;
  if (!envSecret) return process.env.NODE_ENV !== 'production';
  return secret === envSecret;
}
```

### WEBHOOK_SECRET

```
외부 시스템 Webhook 호출 검증 토큰
- 용도: cruisedot/결제시스템 → mabiz 웹훅 검증
- 형식: 256자 이상 (SHA-256 서명)
- 사용처: POST /api/webhook/* 엔드포인트
```

**검증**:
```typescript
// src/app/api/webhook/contact-form-submission/route.ts
const signature = req.headers.get('x-webhook-signature');
const valid = validateWebhookSignature(body, signature, process.env.WEBHOOK_SECRET);
```

---

## 🧪 테스트 시나리오

### 테스트 1: FormSubmission 레코드 생성

**목표**: 폼 제출 시 DB에 레코드가 생성되는지 확인

```bash
# 1. 로컬 서버 시작
npm run dev

# 2. 브라우저: http://localhost:3000 접속
# 3. Contact Form 페이지 찾기
# 4. 폼 작성 및 제출

# 5. Prisma Studio 에서 확인
npx prisma studio
# > FormSubmission 테이블 확인
# > 새 레코드 존재 여부 확인
```

**성공 기준**:
```
FormSubmission 레코드:
├─ id: "clin_xxx" ✓
├─ variant: "a" ✓
├─ segment: "A" ✓
├─ completionTimeMs: 45000 ✓
└─ createdAt: 2026-05-28T14:30:00Z ✓
```

### 테스트 2: SMS API 연동

**목표**: Aligo API에 성공적으로 연결되는지 확인

```bash
# 테스트 실행
npx ts-node scripts/test-aligo-sms.ts --dry-run

# 또는 실제 발송 (자신의 번호로)
npx ts-node scripts/test-aligo-sms.ts
```

**건조 실행 출력**:
```
✓ API Key: xxxxx...
✓ User ID: user@example.com
✓ Sender Phone: 01012345678

🔄 드라이런 모드: 실제 발송하지 않음

발송 예상 결과:
  resultCode: 1 (성공)
  message: "success"
  msgId: "20260528_xxxxxxxx"
```

### 테스트 3: Day 0-3 자동 발송 검증

**목표**: 스케줄된 SMS가 정시에 발송되는지 확인

```bash
# 1. Prisma Studio 에서 ScheduledSms 레코드 생성
npx prisma studio

# 테스트 데이터:
{
  organizationId: "org_001",
  contactId: "contact_123",
  phone: "01012345678",
  message: "[Day 0] 크루즈 여행 테스트",
  scheduledAt: "2026-05-28T14:30:00Z",
  status: "PENDING"
}

# 2. Cron Job 수동 실행
curl -X POST http://localhost:3000/api/cron/scheduled-sms \
  -H "Authorization: Bearer $CRON_SECRET"

# 3. SmsLog 테이블에서 발송 기록 확인
SELECT * FROM "SmsLog" WHERE phone = '01012345678' ORDER BY createdAt DESC;
```

---

## ⚠️ 문제 해결

### 문제 1: "ALIGO_API_KEY 미설정"

```bash
# 원인: 환경변수가 로드되지 않음

# 해결:
1. .env.local 파일 존재 확인
2. NODE_ENV 확인: echo $NODE_ENV
3. 서버 재시작: npm run dev
4. 환경변수 다시 로드: source .env.local
```

### 문제 2: "resultCode: -2 (잘못된 API 키)"

```
원인: API 키가 잘못되었거나 만료됨

해결:
1. Aligo 대시보드에서 API KEY 재확인
2. 복사 & 붙여넣기 시 공백 제거
3. API 키 재생성 후 .env.local 업데이트
```

### 문제 3: "resultCode: -3 (잘못된 수신자 번호)"

```
원인: 발신 번호 형식 오류 또는 미승인

해결:
1. ALIGO_SENDER_PHONE 형식 확인: 01012345678 (하이픈 제거)
2. Aligo > 발신번호 관리 에서 승인 상태 확인
3. 새 번호 등록 후 최소 1시간 대기 후 재시도
```

### 문제 4: "FormSubmission 테이블 없음"

```
원인: Prisma 마이그레이션 미실행

해결:
npx prisma migrate deploy
npx prisma studio  # 테이블 생성 확인
```

---

## ✅ 배포 체크리스트

### Phase 1: 로컬 테스트 완료

- [ ] npm run test:sms 통과
- [ ] Contact Form 폼 제출 성공
- [ ] FormSubmission 테이블 레코드 확인
- [ ] Aligo SMS API 연동 성공 (드라이런)
- [ ] npm run build 빌드 성공

### Phase 2: Vercel 배포

- [ ] .env.example 추가 및 커밋
- [ ] Production 환경변수 설정 (Vercel)
- [ ] 재배포 실행
- [ ] 프로덕션 환경에서 폼 테스트
- [ ] CloudWatch 또는 로그에서 에러 확인

### Phase 3: 모니터링

- [ ] SMS 발송 로그 확인
- [ ] Day 0-3 스케줄 동작 확인
- [ ] 메일 수신 확인 (Email 설정시)
- [ ] 주간 SMS 통계 리포트 생성

---

## 📊 예상 효과

| 메트릭 | 현재 | 목표 | 증가율 |
|--------|------|------|--------|
| 폼 완성율 | 30% | 45% | +50% |
| CTR (Day 0) | 2.0% | 2.7% | +35% |
| CTR (Day 1-3) | 1.5% | 2.2% | +47% |
| 전환율 | 15% | 30% | +100% |
| 월 추가 수익 | - | $76K | +152% |

---

## 📞 지원

| 항목 | 위치 |
|------|------|
| 환경변수 템플릿 | `.env.example` |
| 설정 가이드 | 이 문서 |
| SMS 테스트 | `scripts/test-loop5-sms.ts` |
| API 테스트 | `scripts/test-aligo-sms.ts` |
| Aligo 공식 문서 | https://aligo.in/api/send/ |
| Gmail SMTP | https://myaccount.google.com/apppasswords |

---

## 🎉 완성

**담당**: Agent B  
**완료일**: 2026-05-28  
**산출물**: 4개 파일 (템플릿 + 테스트 스크립트 2개 + 이 가이드)

### 다음 에이전트

**Agent C**: Loop 5-C 폼 최적화 (CTA + A/B 테스트)  
예상 시작: 2026-05-29
