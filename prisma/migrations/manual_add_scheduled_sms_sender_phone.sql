-- Migration: add_scheduled_sms_sender_phone
-- 목적: 대리점별 개별 발신번호 발송 지원 (퍼널문자)
-- 실행 방법: Neon 대시보드 → SQL Editor에 붙여넣기 후 실행
-- 또는 mabiz가 배포된 환경(Vercel/서버)에서 npx prisma db push 실행

-- ScheduledSms에 senderPhone 추가 (없으면 orgSmsConfig.senderPhone 기본값 폴백)
ALTER TABLE "ScheduledSms" ADD COLUMN IF NOT EXISTS "senderPhone" VARCHAR(20);

-- 확인 쿼리
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_name = 'ScheduledSms'
  AND column_name = 'senderPhone';
