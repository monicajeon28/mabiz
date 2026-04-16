-- OrgInviteToken: 판매원 초대 토큰 (WO-27B)
CREATE TABLE "OrgInviteToken" (
  "id"              TEXT        NOT NULL,
  "organizationId"  TEXT        NOT NULL,
  "token"           TEXT        NOT NULL,
  "role"            TEXT        NOT NULL DEFAULT 'AGENT',
  "note"            TEXT,
  "expiresAt"       TIMESTAMPTZ NOT NULL,
  "usedAt"          TIMESTAMPTZ,
  "usedByUserId"    TEXT,
  "agreedToTerms"   BOOLEAN     NOT NULL DEFAULT false,
  "createdByUserId" TEXT,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "OrgInviteToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrgInviteToken_token_key" UNIQUE ("token"),
  CONSTRAINT "OrgInviteToken_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);
CREATE INDEX "OrgInviteToken_organizationId_idx" ON "OrgInviteToken"("organizationId");
CREATE INDEX "OrgInviteToken_expiresAt_idx" ON "OrgInviteToken"("expiresAt");
