-- Step 1: GroupToken 테이블 생성
CREATE TABLE "GroupToken" (
  "id"        TEXT NOT NULL,
  "groupId"   TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "active"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GroupToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GroupToken_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "ContactGroup"("id") ON DELETE CASCADE
);

CREATE INDEX "GroupToken_groupId_idx" ON "GroupToken"("groupId");
CREATE INDEX "GroupToken_expiresAt_idx" ON "GroupToken"("expiresAt");

-- Step 2: CrmLandingPage에 group 관계 추가
ALTER TABLE "CrmLandingPage" ADD CONSTRAINT "CrmLandingPage_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "ContactGroup"("id") ON DELETE SET NULL;

-- groupId에 FK가 없었으므로 인덱스만 확인
CREATE INDEX IF NOT EXISTS "CrmLandingPage_groupId_idx" ON "CrmLandingPage"("groupId");
