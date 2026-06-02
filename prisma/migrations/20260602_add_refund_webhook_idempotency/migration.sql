-- AlterTable: PaymentRefund에 eventId와 status 추가
ALTER TABLE "PaymentRefund"
ADD COLUMN "eventId" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING';

-- CreateIndex: eventId 유니크 인덱스 (멱등성 키)
CREATE UNIQUE INDEX "PaymentRefund_eventId_key" ON "PaymentRefund"("eventId");

-- CreateIndex: paymentId + status 복합 인덱스
CREATE INDEX "PaymentRefund_paymentId_status_idx" ON "PaymentRefund"("paymentId", "status");

-- CreateIndex: eventId 검색 인덱스
CREATE INDEX "PaymentRefund_eventId_idx" ON "PaymentRefund"("eventId");
