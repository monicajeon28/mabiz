-- CruiseProduct 소프트 삭제 필드 추가
ALTER TABLE "CruiseProduct" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "CruiseProduct" ADD COLUMN "deletedBy" TEXT;

-- 삭제 로그 테이블 생성
CREATE TABLE "CruiseProductDeleteLog" (
    "id" SERIAL NOT NULL,
    "productCode" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "productSnapshot" JSONB NOT NULL,
    "contentSnapshot" JSONB,
    "deletedBy" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "driveFileId" TEXT,
    "driveFileUrl" TEXT,
    CONSTRAINT "CruiseProductDeleteLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CruiseProductDeleteLog_productCode_idx" ON "CruiseProductDeleteLog"("productCode");
CREATE INDEX "CruiseProductDeleteLog_deletedAt_idx" ON "CruiseProductDeleteLog"("deletedAt");
