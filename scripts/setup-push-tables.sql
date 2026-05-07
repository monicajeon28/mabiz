-- 웹 푸시 알림 설정을 위한 데이터베이스 테이블 생성
-- 이 스크립트를 Neon, Supabase 또는 로컬 PostgreSQL에서 실행하세요

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

-- 테이블 생성 확인
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('PushSubscription', 'UserPushSettings');
