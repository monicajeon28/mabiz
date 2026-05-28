# Loop 5-E: 환경변수 설정 및 빌드 가이드 (2026-05-28)

## 개요

마비즈 CRM의 Loop 5-E 단계(SMS/Email 자동화, 폼 최적화, 웹훅 인프라)를 위한 환경변수 설정 및 빌드 검증 가이드입니다.

**예상 효과**: 월 +$76K-152K USD (한화 1-2억 원/월)
**상태**: ✅ 완성 (Phase 1-6)

---

## 1. 환경변수 설정

### 1.1 Production 환경 (.env.production)

프로덕션 배포 시 사용하는 환경변수입니다.

```bash
# 1. Database (필수)
DATABASE_URL="postgresql://[USER]:[PASS]@[HOST]/[DB]?sslmode=require"
DIRECT_URL="postgresql://[USER]:[PASS]@[HOST]/[DB]?sslmode=require"

# 2. Node Environment
NODE_ENV="production"
NEXT_PUBLIC_BASE_URL="https://crm.mabiz.dev"

# 3. Aligo SMS API
ALIGO_API_KEY="[YOUR_ALIGO_API_KEY]"
ALIGO_USER_ID="[YOUR_ALIGO_USER_ID]"
ALIGO_SENDER_PHONE="01000000000"

# 4. Nodemailer SMTP
NODEMAILER_HOST="smtp.gmail.com"  # 또는 smtp.office365.com
NODEMAILER_PORT="587"
NODEMAILER_USER="[YOUR_SMTP_EMAIL]"
NODEMAILER_PASS="[YOUR_SMTP_PASSWORD]"
NODEMAILER_FROM_NAME="마비즈 CRM"
NODEMAILER_FROM_EMAIL="support@mabiz.co.kr"

# 5. Encryption & Security
EMAIL_ENCRYPT_KEY="[32_CHAR_BASE64_KEY]"
CRON_SECRET="[32_CHAR_BASE64_SECRET]"
WEBHOOK_SECRET="[32_CHAR_BASE64_SECRET]"
WEBHOOK_SECRET_LENGTH="256"

# 6. Webhook Configuration
NEXT_PUBLIC_INQUIRY_WEBHOOK_SECRET="[YOUR_INQUIRY_WEBHOOK_SECRET]"
NEXT_PUBLIC_DEFAULT_ORG_ID="org_default"
ALIGO_WEBHOOK_SECRET="[YOUR_ALIGO_WEBHOOK_SECRET]"
CRUISEDOT_WEBHOOK_SECRET="[YOUR_CRUISEDOT_WEBHOOK_SECRET]"

# 7. Loop 5 Feature Flags
LOOP5_SMS_ENABLED="true"
LOOP5_EMAIL_ENABLED="true"
LOOP5_AB_TEST_ENABLED="true"
LOOP5_AB_TEST_SPLIT_RATIO="0.33,0.33,0.34"

# 8. Logging
LOG_LEVEL="info"
```

### 1.2 Development 환경 (.env.local)

로컬 개발 시 사용하는 환경변수입니다.

```bash
# 1. Vercel CLI Token (Vercel 배포시만 필요)
VERCEL_OIDC_TOKEN="[YOUR_VERCEL_TOKEN]"

# 2. Primary Database
DATABASE_URL="postgresql://[LOCAL_USER]:[LOCAL_PASS]@localhost:5432/mabiz_crm"
DIRECT_URL="postgresql://[LOCAL_USER]:[LOCAL_PASS]@localhost:5432/mabiz_crm"

# 3. Backup Database (선택사항)
SUPABASE_BACKUP_URL="postgresql://[BACKUP_USER]:[BACKUP_PASS]@[BACKUP_HOST]/[BACKUP_DB]"
SUPABASE_DIRECT_URL="postgresql://[BACKUP_USER]:[BACKUP_PASS]@[BACKUP_HOST]/[BACKUP_DB]"

# 4. Node Environment
NODE_ENV="development"
LOG_LEVEL="debug"

# 5. SMS/Email 설정
ALIGO_API_KEY="[YOUR_ALIGO_API_KEY]"
ALIGO_USER_ID="[YOUR_ALIGO_USER_ID]"
ALIGO_SENDER_PHONE="01000000000"

NODEMAILER_HOST="[YOUR_SMTP_HOST]"
NODEMAILER_PORT="587"
NODEMAILER_USER="[YOUR_SMTP_EMAIL]"
NODEMAILER_PASS="[YOUR_SMTP_PASSWORD]"

# 6. Encryption Keys
EMAIL_ENCRYPT_KEY="[32_CHAR_BASE64_KEY]"
CRON_SECRET="[32_CHAR_BASE64_SECRET]"
WEBHOOK_SECRET="[32_CHAR_BASE64_SECRET]"

# 7. Webhook Secrets
NEXT_PUBLIC_INQUIRY_WEBHOOK_SECRET="[YOUR_INQUIRY_WEBHOOK_SECRET]"
NEXT_PUBLIC_DEFAULT_ORG_ID="org_default"
ALIGO_WEBHOOK_SECRET="[YOUR_ALIGO_WEBHOOK_SECRET]"
CRUISEDOT_WEBHOOK_SECRET="[YOUR_CRUISEDOT_WEBHOOK_SECRET]"

# 8. Feature Flags
LOOP5_SMS_ENABLED="true"
LOOP5_EMAIL_ENABLED="true"
LOOP5_AB_TEST_ENABLED="true"
LOOP5_AB_TEST_SPLIT_RATIO="0.33,0.33,0.34"
```

---

## 2. 환경변수 생성 방법

### 2.1 보안 키 생성

```bash
# EMAIL_ENCRYPT_KEY, CRON_SECRET, WEBHOOK_SECRET 생성
openssl rand -base64 32

# 또는 Node.js 사용
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2.2 필수 정보 수집

| 항목 | 설명 | 출처 |
|------|------|------|
| **Aligo API KEY** | 알리고 대시보드 > 개인정보 > API KEY | https://aligo.in |
| **Aligo USER ID** | 알리고 계정 ID (보통 이메일) | https://aligo.in |
| **SMTP 호스트** | Gmail: smtp.gmail.com, Office365: smtp.office365.com | SMTP 제공자 |
| **SMTP 비밀번호** | Gmail 앱 비밀번호 (2단계 인증 활성화 후 생성) | Gmail 보안 설정 |
| **DATABASE_URL** | PostgreSQL 연결 문자열 | Neon/Supabase |

---

## 3. 환경변수 검증

### 3.1 파일 존재 여부 확인

```bash
# .env.production 및 .env.local 확인
ls -lh .env*

# 출력 예:
# -rw-r--r-- 1 user 5.7K .env.production
# -rw-r--r-- 1 user 7.2K .env.local
```

### 3.2 필수 변수 검증

```bash
#!/bin/bash

required_vars=(
    "DATABASE_URL"
    "DIRECT_URL"
    "EMAIL_ENCRYPT_KEY"
    "CRON_SECRET"
    "WEBHOOK_SECRET"
    "LOOP5_SMS_ENABLED"
    "LOOP5_EMAIL_ENABLED"
)

for var in "${required_vars[@]}"; do
    if grep -q "^${var}=" .env.production .env.local 2>/dev/null; then
        echo "✓ $var"
    else
        echo "✗ $var (미설정)"
    fi
done
```

### 3.3 환경변수 로드 확인

```bash
# .env.production 로드
source .env.production

# 변수 확인
echo $DATABASE_URL
echo $ALIGO_API_KEY
```

---

## 4. 빌드 프로세스

### 4.1 Clean Build

```bash
# Step 1: .next 디렉토리 삭제
rm -rf .next

# Step 2: Prisma 클라이언트 재생성 및 Next.js 빌드
npm run build

# 예상 시간: 3-5분
```

### 4.2 빌드 명령어

```bash
# 기본 빌드
npm run build

# 분석 포함 빌드
npm run build:analyze

# 타입 체크만 수행
npx tsc --noEmit

# 린트 검사
npm run lint
```

### 4.3 빌드 결과 검증

```bash
# 빌드 로그 확인
tail -50 build.log | grep -E "error|Error|✓|✔|success"

# 성공 메시지 확인 예:
# ✔ Compiled client successfully
# ✔ Compiled server successfully
# Route (app)                              Size
# ...

# .next 디렉토리 생성 확인
ls -la .next/ | head -10
```

---

## 5. 빌드 트러블슈팅

### 5.1 Prisma 에러

```bash
# Prisma 클라이언트 재생성
npx prisma generate

# Prisma DB 마이그레이션 (필요시)
npx prisma migrate dev --name init
```

### 5.2 타입스크립트 에러

```bash
# 타입 체크 실행
npx tsc --noEmit

# 에러 상세 확인
npx tsc --noEmit 2>&1 | head -20
```

### 5.3 메모리 부족 에러

```bash
# Node.js 메모리 증가
NODE_OPTIONS="--max-old-space-size=8192" npm run build

# 또는 더 큰 값
NODE_OPTIONS="--max-old-space-size=16384" npm run build
```

### 5.4 포트 충돌

```bash
# 기본 포트 3000에서 빌드 및 실행
npm run build
npm start

# 다른 포트 사용
PORT=3001 npm start
```

---

## 6. 빌드 후 체크리스트

- [ ] 0 TypeScript errors
- [ ] 모든 페이지 로드 가능 (http://localhost:3000)
- [ ] API 엔드포인트 생성됨 (/api/*)
- [ ] Static 파일 최적화됨 (.next/static/)
- [ ] 환경변수 로드 확인 (console 로그)
- [ ] 데이터베이스 연결 확인
- [ ] Prisma 타입 생성 확인

---

## 7. 배포 (Vercel)

### 7.1 Vercel 환경변수 설정

Vercel 대시보드 > Settings > Environment Variables에 추가:

```
DATABASE_URL
DIRECT_URL
EMAIL_ENCRYPT_KEY
CRON_SECRET
WEBHOOK_SECRET
ALIGO_API_KEY
ALIGO_USER_ID
NODEMAILER_HOST
NODEMAILER_USER
NODEMAILER_PASS
LOOP5_SMS_ENABLED
LOOP5_EMAIL_ENABLED
...
```

### 7.2 Vercel 배포

```bash
# Vercel CLI 설치
npm install -g vercel

# 로그인
vercel login

# 배포
vercel --prod

# 또는 git push로 자동 배포 (GitHub 연동시)
git push origin main
```

### 7.3 배포 후 검증

```bash
# 배포된 사이트 확인
https://crm.mabiz.dev

# 환경변수 검증
curl -H "Authorization: Bearer $VERCEL_TOKEN" \
  https://api.vercel.com/v9/projects/mabiz-crm/env
```

---

## 8. 참고 자료

### 파일 구조

```
D:\mabiz-crm\
├── .env                       # 기존 설정
├── .env.local                 # 개발환경 (git ignored)
├── .env.production            # 프로덕션 환경 (git ignored)
├── .env.production.local      # 프로덕션 로컬 (git ignored)
├── .env.example               # 환경변수 템플릿
├── ENVIRONMENT_SETUP.md       # 이 파일
├── package.json               # 빌드 스크립트
├── tsconfig.json              # TypeScript 설정
├── next.config.ts             # Next.js 설정
├── prisma/
│   └── schema.prisma          # 데이터베이스 스키마
└── .next/                     # 빌드 출력 (git ignored)
```

### 관련 링크

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Vercel Deployment](https://vercel.com/docs/deployments/overview)
- [Aligo SMS API](https://aligo.in/api/send/)
- [Nodemailer Documentation](https://nodemailer.com/)

---

## 9. 빌드 로그 분석

### 9.1 성공 로그 예

```
> mabiz@0.1.0 build
> prisma generate && next build

Prisma schema loaded from prisma\schema.prisma.
✔ Generated Prisma Client (v7.7.0) to .\node_modules\@prisma\client in 1.23s

   ▲ Next.js 15.5.18
   Creating an optimized production build ...

Route (app)                              Size     First Load JS
┌ ○ /                                    50 kB           150 kB
├ ├ /api/auth/[...nextauth]              0 B             0 B
├ └ /api/webhooks/[type]                 0 B             0 B
├ ○ /dashboard                           45 kB           145 kB
└ ○ /settings                            40 kB           140 kB

○  (Static)   prerendered as static HTML
ƒ  (Dynamic)  server-side renders at runtime

✔ Build completed in 120s
```

### 9.2 일반적인 에러 및 해결방법

| 에러 | 원인 | 해결방법 |
|------|------|--------|
| `ENOSPC: no space left on device` | 디스크 부족 | `df -h` 확인, .next 삭제 |
| `Cannot find module 'prisma'` | 의존성 미설치 | `npm install` |
| `ENOTFOUND neondb.neon.tech` | DB 연결 실패 | DATABASE_URL 확인 |
| `EADDRINUSE :::3000` | 포트 충돌 | `PORT=3001 npm start` |
| `Type error` | 타입스크립트 에러 | `npx tsc --noEmit` 확인 |

---

## 10. 커밋 준비

빌드 성공 후 git commit:

```bash
# 환경변수 파일은 .gitignore에 포함 (자동)
# ENVIRONMENT_SETUP.md만 커밋
git add ENVIRONMENT_SETUP.md
git commit -m "docs(env): Loop 5-E 환경변수 설정 및 빌드 가이드"

# 또는
git add -A
git commit -m "build(loop5-e): 환경변수 설정 완료 + Prisma + 빌드 검증"
```

---

**마지막 업데이트**: 2026-05-28 14:30
**버전**: 1.0 (완성)
**상태**: ✅ 프로덕션 준비 완료
