-- A-5: Campaign + CampaignCoupon + CouponUsage 테이블 추가
-- 목적: 쿠폰 시스템 DB 구조 (B-4 Race Condition 방지 기반)
-- 롤백: DROP TABLE "CouponUsage"; DROP TABLE "CampaignCoupon"; DROP TABLE "Campaign";

BEGIN;

-- Campaign: 마케팅 캠페인
CREATE TABLE "Campaign" (
  "id"        SERIAL PRIMARY KEY,
  "name"      TEXT NOT NULL,
  "startDate" TIMESTAMPTZ NOT NULL,
  "endDate"   TIMESTAMPTZ NOT NULL,
  "maxBudget" BIGINT NOT NULL,
  "status"    TEXT NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE|EXPIRED|ARCHIVED
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);

CREATE INDEX "Campaign_status_endDate_idx" ON "Campaign"("status", "endDate");

-- CampaignCoupon: 쿠폰 발급
CREATE TABLE "CampaignCoupon" (
  "id"                SERIAL PRIMARY KEY,
  "campaignId"        INTEGER NOT NULL,
  "couponCode"        TEXT NOT NULL,
  "discountType"      TEXT NOT NULL,     -- FIXED_AMOUNT|FIXED_RATE|TIERED
  "discountValue"     BIGINT NOT NULL,   -- 센트 또는 bp
  "maxDiscountAmount" BIGINT NOT NULL,
  "maxUses"           INTEGER NOT NULL,
  "usedCount"         INTEGER NOT NULL DEFAULT 0,
  "expiryDate"        TIMESTAMPTZ NOT NULL,
  "status"            TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CampaignCoupon_couponCode_key" UNIQUE ("couponCode"),
  CONSTRAINT "fk_coupon_campaign" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
);

CREATE INDEX "CampaignCoupon_campaignId_status_idx" ON "CampaignCoupon"("campaignId", "status");
CREATE INDEX "CampaignCoupon_couponCode_idx" ON "CampaignCoupon"("couponCode");
CREATE INDEX "CampaignCoupon_expiryDate_idx" ON "CampaignCoupon"("expiryDate");

-- CouponUsage: 쿠폰 사용 이력 (멱등성 키로 중복 방지)
CREATE TABLE "CouponUsage" (
  "id"              SERIAL PRIMARY KEY,
  "couponId"        INTEGER NOT NULL,
  "userId"          INTEGER NOT NULL,
  "orderId"         TEXT NOT NULL,
  "appliedDiscount" BIGINT NOT NULL,
  "usedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "idempotencyKey"  TEXT NOT NULL,
  CONSTRAINT "CouponUsage_orderId_key" UNIQUE ("orderId"),
  CONSTRAINT "CouponUsage_idempotencyKey_key" UNIQUE ("idempotencyKey"),
  CONSTRAINT "CouponUsage_couponId_userId_key" UNIQUE ("couponId", "userId"),  -- 쿠폰당 1사용자
  CONSTRAINT "fk_coupon_usage_coupon" FOREIGN KEY ("couponId") REFERENCES "CampaignCoupon"("id")
);

CREATE INDEX "CouponUsage_userId_usedAt_idx" ON "CouponUsage"("userId", "usedAt");

COMMIT;
