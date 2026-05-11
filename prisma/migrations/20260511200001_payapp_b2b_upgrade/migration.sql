-- ============================================================
-- PayApp B2B 결제 시스템 업그레이드
-- ============================================================
-- ⚠️  수동 실행 전용 — prisma migrate deploy 사용 금지
-- ⚠️  CRM 전용 테이블만 변경 — 크루즈닷몰 공유 테이블 절대 미접촉
-- ============================================================

-- 1. CrmPayAppPayment 컬럼 추가 (10개)
ALTER TABLE "CrmPayAppPayment" ADD COLUMN IF NOT EXISTS "productName" TEXT;
ALTER TABLE "CrmPayAppPayment" ADD COLUMN IF NOT EXISTS "customerEmail" TEXT;
ALTER TABLE "CrmPayAppPayment" ADD COLUMN IF NOT EXISTS "mulNo" TEXT;
ALTER TABLE "CrmPayAppPayment" ADD COLUMN IF NOT EXISTS "payType" TEXT;
ALTER TABLE "CrmPayAppPayment" ADD COLUMN IF NOT EXISTS "cardName" TEXT;
ALTER TABLE "CrmPayAppPayment" ADD COLUMN IF NOT EXISTS "cstUrl" TEXT;
ALTER TABLE "CrmPayAppPayment" ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);
ALTER TABLE "CrmPayAppPayment" ADD COLUMN IF NOT EXISTS "refundAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CrmPayAppPayment" ADD COLUMN IF NOT EXISTS "refundReason" TEXT;
ALTER TABLE "CrmPayAppPayment" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "CrmPayAppPayment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "CrmPayAppPayment" ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT;

-- 2. CrmPayAppPayment 인덱스 추가
CREATE INDEX IF NOT EXISTS "CrmPayAppPayment_mulNo_idx" ON "CrmPayAppPayment"("mulNo");
CREATE INDEX IF NOT EXISTS "CrmPayAppPayment_status_idx" ON "CrmPayAppPayment"("status");

-- 3. CrmPayAppSubscription 테이블 생성 (정기결제)
CREATE TABLE IF NOT EXISTS "CrmPayAppSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "rebillNo" TEXT NOT NULL,
    "goodname" TEXT NOT NULL,
    "goodprice" INTEGER NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "cycleDay" INTEGER NOT NULL DEFAULT 1,
    "expireDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payUrl" TEXT,
    "landingPageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmPayAppSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmPayAppSubscription_rebillNo_key" ON "CrmPayAppSubscription"("rebillNo");
CREATE INDEX IF NOT EXISTS "CrmPayAppSubscription_organizationId_idx" ON "CrmPayAppSubscription"("organizationId");
CREATE INDEX IF NOT EXISTS "CrmPayAppSubscription_status_idx" ON "CrmPayAppSubscription"("status");

-- 4. FK: CrmPayAppPayment → CrmPayAppSubscription
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmPayAppPayment_subscriptionId_fkey'
  ) THEN
    ALTER TABLE "CrmPayAppPayment"
      ADD CONSTRAINT "CrmPayAppPayment_subscriptionId_fkey"
      FOREIGN KEY ("subscriptionId") REFERENCES "CrmPayAppSubscription"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

-- 5. CrmLandingPage 결제 설정 컬럼 추가
ALTER TABLE "CrmLandingPage" ADD COLUMN IF NOT EXISTS "paymentEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CrmLandingPage" ADD COLUMN IF NOT EXISTS "paymentType" TEXT;
ALTER TABLE "CrmLandingPage" ADD COLUMN IF NOT EXISTS "productName" TEXT;
ALTER TABLE "CrmLandingPage" ADD COLUMN IF NOT EXISTS "productPrice" INTEGER;
ALTER TABLE "CrmLandingPage" ADD COLUMN IF NOT EXISTS "cycleDay" INTEGER;
ALTER TABLE "CrmLandingPage" ADD COLUMN IF NOT EXISTS "expireDate" TIMESTAMP(3);
