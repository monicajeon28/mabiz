# 웹 푸시 알림 설정 가이드

## 1️⃣ 환경변수 설정 (.env)

생성된 VAPID 키를 `.env` 파일에 추가하세요:

```env
# 웹 푸시 VAPID 키 (web-push generate-vapid-keys로 생성)
VAPID_PUBLIC_KEY=BEqa4kSYkx-MRJpKWmJiEdcf6Tah14JNqodRf1O1MhRZqgYBjjBviov3SkMPWIV1m-0k6ts-MZ-zPb8_hzhxHuM
VAPID_PRIVATE_KEY=Rsc07-KudUGW5kmui5j_sbe92MHD50E4bwvgTH47Abw
VAPID_EMAIL=mailto:admin@mabiz.kr

# Vercel Crons 인증 (자동 푸시용)
CRON_SECRET=your-secret-token-here
```

---

## 2️⃣ 데이터베이스 테이블 생성

다음 SQL을 PostgreSQL에서 실행하세요 (Neon, Supabase, 또는 로컬 DB):

```sql
-- 웹 푸시 구독 정보 테이블
CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL UNIQUE,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_sub_userId ON "PushSubscription"("userId");

-- 사용자별 푸시 설정 테이블
CREATE TABLE IF NOT EXISTS "UserPushSettings" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL UNIQUE,
  "notifyEnabled" BOOLEAN NOT NULL DEFAULT true,
  "notifyAtHour" SMALLINT NOT NULL DEFAULT 9,
  "lastPushedAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
```

**Neon 또는 Supabase에서 SQL 실행 방법:**
1. 대시보드에서 SQL Editor 열기
2. 위 SQL 전체 복사 및 붙여넣기
3. "Execute" 클릭

---

## 3️⃣ 검증

```bash
# Prisma Client 재생성 (이미 실행됨)
npx prisma generate

# 스키마 확인
npx prisma db push --skip-generate  # 또는 schema 검증만

# 테이블 생성 확인 (psql 또는 대시보드)
SELECT * FROM "PushSubscription" LIMIT 0;
SELECT * FROM "UserPushSettings" LIMIT 0;
```

---

## 4️⃣ 테스트

### 브라우저 테스트
1. 로컬 또는 스테이징 환경에서 `npm run dev` 실행
2. 대시보드 접속
3. "📱 폰으로 보내기" 버튼 클릭
4. 브라우저 푸시 권한 요청 → "Allow" 클릭
5. 스마트폰에 알림 수신 확인

### 자동 푸시 테스트 (로컬)
```bash
# 수동으로 cron 엔드포인트 호출
curl -H "Authorization: Bearer your-secret-token" \
  http://localhost:3000/api/cron/push-daily
```

---

## 5️⃣ Vercel 배포 시

1. Vercel 프로젝트 설정 → "Environment Variables"
2. 위 3개 환경변수 추가:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `CRON_SECRET` (임의의 강한 토큰 생성)

3. `vercel.json`에 이미 cron 설정이 있으므로 추가 작업 불필요

---

## 🔍 Troubleshooting

| 문제 | 원인 | 해결책 |
|------|------|--------|
| "등록된 푸시 구독이 없습니다" | 브라우저가 구독 정보를 저장하지 못함 | HTTPS 환경 확인 (localhost는 OK) |
| "pushSubscription is not a function" | Prisma 모델 누락 | `npx prisma generate` 재실행 |
| 자동 푸시가 발송 안 됨 | CRON_SECRET 불일치 또는 vercel.json 누락 | 배포 후 Vercel 로그 확인 |
| 스마트폰에 알림 안 나옴 | 사용자가 브라우저 알림 거부 | 설정 → 알림 권한 다시 허용 |

---

## 📚 참고자료

- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [web-push npm](https://www.npmjs.com/package/web-push)
- [Vercel Crons](https://vercel.com/docs/cron-jobs)
