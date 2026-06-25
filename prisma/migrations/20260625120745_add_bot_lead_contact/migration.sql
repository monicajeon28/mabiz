-- 크루즈닷봇 Phase 6 (2026-06-25): BotConversation 에 손님 연락처(후속 클로징 SMS용) 추가. 멱등.
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='BotConversation' AND column_name='customerPhone') THEN
    ALTER TABLE "BotConversation" ADD COLUMN "customerPhone" TEXT;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='BotConversation' AND column_name='customerName') THEN
    ALTER TABLE "BotConversation" ADD COLUMN "customerName" TEXT;
  END IF;
END $$;
