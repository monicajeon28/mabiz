-- Phase 1: Contact ↔ User 명시적 연결
ALTER TABLE "Contact" ADD COLUMN "userId" INT;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;
CREATE INDEX "Contact_userId_idx" ON "Contact"("userId");

-- Phase 2: MarketingLead ↔ Contact 통합
ALTER TABLE "MarketingLead" ADD COLUMN "contactId" INT;
ALTER TABLE "MarketingLead" ADD CONSTRAINT "MarketingLead_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE;
CREATE UNIQUE INDEX "MarketingLead_contactId_key" ON "MarketingLead"("contactId");

-- 중복 방지: accountId + email + phone UNIQUE 제약
ALTER TABLE "MarketingLead" ADD CONSTRAINT "MarketingLead_accountId_email_phone_key" UNIQUE("accountId", "email", "phone");

-- Phase 3: 퍼널 상태 전이 (State Machine)
CREATE TABLE "FunnelStageTransition" (
  "id" SERIAL NOT NULL,
  "funnelId" INTEGER NOT NULL,
  "fromStageId" INTEGER NOT NULL,
  "toStageId" INTEGER NOT NULL,
  "triggerType" VARCHAR(255) NOT NULL,
  "requiredCondition" JSONB,
  "daysToWait" INTEGER,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FunnelStageTransition_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FunnelStageTransition" ADD CONSTRAINT "FunnelStageTransition_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "MarketingFunnel"("id") ON DELETE CASCADE;
ALTER TABLE "FunnelStageTransition" ADD CONSTRAINT "FunnelStageTransition_fromStageId_fkey" FOREIGN KEY ("fromStageId") REFERENCES "FunnelStage"("id") ON DELETE CASCADE;
ALTER TABLE "FunnelStageTransition" ADD CONSTRAINT "FunnelStageTransition_toStageId_fkey" FOREIGN KEY ("toStageId") REFERENCES "FunnelStage"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "FunnelStageTransition_fromStageId_toStageId_triggerType_key" ON "FunnelStageTransition"("fromStageId", "toStageId", "triggerType");
CREATE INDEX "FunnelStageTransition_funnelId_idx" ON "FunnelStageTransition"("funnelId");
CREATE INDEX "FunnelStageTransition_isActive_idx" ON "FunnelStageTransition"("isActive");
CREATE INDEX "FunnelStageTransition_priority_idx" ON "FunnelStageTransition"("priority");

-- Phase 4: SMS 중복 발송 방지
ALTER TABLE "ScheduledMessageLog" ADD COLUMN "idempotencyKey" VARCHAR(100);
ALTER TABLE "ScheduledMessageLog" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ScheduledMessageLog" ADD COLUMN "nextRetryAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "ScheduledMessageLog_idempotencyKey_key" ON "ScheduledMessageLog"("idempotencyKey");
CREATE UNIQUE INDEX "ScheduledMessageLog_scheduledMessageId_userId_stageNumber_sentAt_date_key"
  ON "ScheduledMessageLog"(
    "scheduledMessageId",
    "userId",
    "stageNumber",
    DATE("sentAt")
  );
CREATE INDEX "ScheduledMessageLog_status_sentAt_idx" ON "ScheduledMessageLog"("status", "sentAt");

-- Phase 5: 수신거부 추적 (법규 준수)
CREATE TABLE "SubscriptionPreference" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "messageType" VARCHAR(255) NOT NULL,
  "channelType" VARCHAR(255) NOT NULL,
  "status" VARCHAR(255) NOT NULL DEFAULT 'subscribed',
  "unsubscribedAt" TIMESTAMP(3),
  "unsubscribeReason" TEXT,
  "resubscribedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPreference_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SubscriptionPreference" ADD CONSTRAINT "SubscriptionPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "SubscriptionPreference_userId_messageType_channelType_key"
  ON "SubscriptionPreference"("userId", "messageType", "channelType");
CREATE INDEX "SubscriptionPreference_status_idx" ON "SubscriptionPreference"("status");
CREATE INDEX "SubscriptionPreference_userId_status_idx" ON "SubscriptionPreference"("userId", "status");
