-- AddColumn: ImageAsset 워터마크+WebP 처리 결과 필드 추가
-- 크루즈닷몰 공유 테이블 절대 건드리지 않음 — ImageAsset CRM 전용 테이블만 수정

ALTER TABLE "ImageAsset" ADD COLUMN IF NOT EXISTS "webpDriveFileId" TEXT;
ALTER TABLE "ImageAsset" ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMPTZ;
ALTER TABLE "ImageAsset" ADD COLUMN IF NOT EXISTS "processingStatus" TEXT NOT NULL DEFAULT 'PENDING';
