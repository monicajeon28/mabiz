-- 대리점장 구매확인(귀속 확정) 신호 — 미러 AffiliateSale(public_AffiliateSale)에 4컬럼 추가.
-- 몰=수당귀속 SSoT, CRM은 결제관리 2택 확정 → 몰 발신용 상태/멱등가드 보관.
-- additive nullable / boolean default → 무중단. IF NOT EXISTS로 수동적용(scripts/apply-commission-owner.mjs)된 DB에서도 no-op.
ALTER TABLE "AffiliateSale"
  ADD COLUMN IF NOT EXISTS "commissionOwnerType" TEXT,
  ADD COLUMN IF NOT EXISTS "commissionOwnerConfirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "confirmedOwnerById" INTEGER,
  ADD COLUMN IF NOT EXISTS "confirmedOwnerAt" TIMESTAMP(3);
