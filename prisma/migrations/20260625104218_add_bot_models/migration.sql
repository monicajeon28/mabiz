-- 크루즈닷봇 Phase 1 (2026-06-25)
-- BotConversation / BotMessage / BotKnowledgeChunk 신규 + CrmLandingPage.pageType/botConfig
-- 멱등(idempotent): IF NOT EXISTS 가드로 재실행 안전 (팀 컨벤션)

-- 1) CrmLandingPage: 봇 탑재 랜딩 식별 필드
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='CrmLandingPage' AND column_name='pageType') THEN
    ALTER TABLE "CrmLandingPage" ADD COLUMN "pageType" VARCHAR(20) NOT NULL DEFAULT 'standard';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='CrmLandingPage' AND column_name='botConfig') THEN
    ALTER TABLE "CrmLandingPage" ADD COLUMN "botConfig" JSONB;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "CrmLandingPage_organizationId_pageType_idx" ON "CrmLandingPage"("organizationId", "pageType");

-- 2) BotConversation (봇 상담 대화 세션)
CREATE TABLE IF NOT EXISTS "BotConversation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "landingPageId" TEXT,
  "attributedAgentId" TEXT,
  "attributionSource" TEXT,
  "shortLinkCode" TEXT,
  "visitorId" TEXT NOT NULL,
  "contactId" TEXT,
  "channel" TEXT NOT NULL DEFAULT 'bot_landing',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "fsmState" TEXT NOT NULL DEFAULT 'OPENING',
  "closeAttempts" INTEGER NOT NULL DEFAULT 0,
  "intentScore" INTEGER NOT NULL DEFAULT 0,
  "purchaseInquiryId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BotConversation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BotConversation_organizationId_attributedAgentId_createdAt_idx" ON "BotConversation"("organizationId", "attributedAgentId", "createdAt");
CREATE INDEX IF NOT EXISTS "BotConversation_shortLinkCode_idx" ON "BotConversation"("shortLinkCode");
CREATE INDEX IF NOT EXISTS "BotConversation_status_lastMessageAt_idx" ON "BotConversation"("status", "lastMessageAt");

-- 3) BotMessage (봇 대화 메시지)
CREATE TABLE IF NOT EXISTS "BotMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'complete',
  "modelUsed" TEXT,
  "ragSourceIds" JSONB,
  "objectionType" TEXT,
  "tokensIn" INTEGER,
  "tokensOut" INTEGER,
  "cacheReadTokens" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BotMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BotMessage_conversationId_createdAt_idx" ON "BotMessage"("conversationId", "createdAt");

-- 4) BotKnowledgeChunk (RAG 지식청크 — 2단계 pgvector는 추후 raw SQL로 embedding 컬럼 추가)
CREATE TABLE IF NOT EXISTS "BotKnowledgeChunk" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT,
  "title" TEXT,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BotKnowledgeChunk_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BotKnowledgeChunk_organizationId_sourceType_idx" ON "BotKnowledgeChunk"("organizationId", "sourceType");

-- 5) 외래키 제약 (멱등)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'BotConversation_contactId_fkey') THEN
    ALTER TABLE "BotConversation" ADD CONSTRAINT "BotConversation_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'BotMessage_conversationId_fkey') THEN
    ALTER TABLE "BotMessage" ADD CONSTRAINT "BotMessage_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "BotConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
