# Loop 5-B 빠른 시작 가이드 (5분)

**Agent B 완료 보고서** | 2026-05-28

---

## ⚡ 30초 요약

| 작업 | 명령어 | 소요시간 |
|------|--------|---------|
| 환경변수 확인 | `npx ts-node scripts/test-loop5-sms.ts` | 2분 |
| SMS API 테스트 | `npx ts-node scripts/test-aligo-sms.ts --dry-run` | 2분 |
| 로컬 서버 실행 | `npm run dev` | 1분 |
| 폼 제출 테스트 | 브라우저 > Contact Form 제출 | 1분 |

**총 시간**: 6분

---

## 📋 체크리스트

### 1단계: 환경변수 설정 (5분)

```bash
# .env.example 에서 필수 값 복사
# .env.local 에 실제 값 입력:
# - ALIGO_API_KEY (https://aligo.in 에서 복사)
# - ALIGO_USER_ID (가입 이메일)
# - ALIGO_SENDER_PHONE (승인된 발신번호)
# - EMAIL_ENCRYPT_KEY (자동생성: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

### 2단계: 테스트 실행 (2분)

```bash
npx ts-node scripts/test-loop5-sms.ts
```

**예상 결과**:
```
✓ PASS: 10
✗ FAIL: 0

✅ 모든 필수 항목이 설정되었습니다!
```

### 3단계: 로컬 테스트 (3분)

```bash
npm run dev
# http://localhost:3000 > Contact Form > 제출
# Prisma Studio: npx prisma studio > FormSubmission 확인
```

### 4단계: 배포 (5분)

```bash
# Vercel 대시보드 > Settings > Environment Variables > Production
# 다음 환경변수 추가:
# - ALIGO_API_KEY
# - ALIGO_USER_ID
# - ALIGO_SENDER_PHONE
# - EMAIL_ENCRYPT_KEY (선택)
# - CRON_SECRET
# - WEBHOOK_SECRET

# 재배포
git push origin main
```

---

## 🔧 필수 환경변수만 (4개)

```env
ALIGO_API_KEY="[API_KEY]"               # SMS 발송용
ALIGO_USER_ID="[USER_ID]"               # SMS 발송용
ALIGO_SENDER_PHONE="01012345678"        # SMS 발신번호 (하이픈 제거)
EMAIL_ENCRYPT_KEY="[32자_이상_난수]"    # 비밀번호 암호화용
```

**생성 방법**:
```bash
# EMAIL_ENCRYPT_KEY 생성
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# CRON_SECRET 생성
openssl rand -hex 32

# WEBHOOK_SECRET 생성
openssl rand -hex 128
```

---

## 🚀 SMS Day 0-3 자동 발송

| Day | 시간 | 심리학 | 내용 |
|-----|------|--------|------|
| 0 | 즉시 | P (Problem) | "혼자는 너무 외로워요" |
| 1 | 24시간 후 | S (Solution) | "마비즈 크루즈 추천" |
| 2 | 48시간 후 | O (Offer) | "한정 예약 소식" |
| 3 | 72시간 후 | N (Now) | "12시간만 더" |

---

## 📁 핵심 파일

| 파일 | 용도 |
|------|------|
| `.env.example` | 모든 환경변수 설명서 |
| `scripts/test-loop5-sms.ts` | 전체 시스템 점검 |
| `scripts/test-aligo-sms.ts` | SMS API 점검 |
| `docs/LOOP5_B_ENVIRONMENT_SETUP_GUIDE.md` | 상세 가이드 (13KB) |

---

## 🔗 외부 링크

| 서비스 | URL | 용도 |
|--------|-----|------|
| Aligo 대시보드 | https://aligo.in | API 키 확인 |
| Gmail 앱 비밀번호 | https://myaccount.google.com/apppasswords | SMTP 설정 |
| Vercel 대시보드 | https://vercel.com/dashboard | 환경변수 설정 |

---

## ❌ 문제 해결 (2가지)

### 문제 1: "ALIGO_API_KEY 미설정"
```bash
# 해결
1. .env.local 파일 확인
2. npm run dev 재시작
3. npx ts-node scripts/test-loop5-sms.ts 재실행
```

### 문제 2: "FormSubmission 테이블 없음"
```bash
# 해결
npx prisma migrate deploy
npx prisma studio  # 테이블 생성 확인
```

---

## ✅ 완성 체크

- [x] `.env.example` 작성
- [x] `scripts/test-loop5-sms.ts` 작성
- [x] `scripts/test-aligo-sms.ts` 작성
- [x] 상세 가이드 작성
- [x] .env.local 업데이트

**배포 준비 완료!**

---

**다음**: Agent C - Loop 5-C 폼 최적화 (예상 2026-05-29)
