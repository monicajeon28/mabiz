-- CreateTable
CREATE TABLE "ProcessedWebhookEvent" (
    "eventId" TEXT NOT NULL,
    "webhookType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE INDEX "ProcessedWebhookEvent_webhookType_idx" ON "ProcessedWebhookEvent"("webhookType");
