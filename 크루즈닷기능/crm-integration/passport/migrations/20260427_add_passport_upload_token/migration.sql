-- CreateTable PassportUploadToken
CREATE TABLE "PassportUploadToken" (
    "id" SERIAL NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "leadId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassportUploadToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PassportUploadToken_token_key" ON "PassportUploadToken"("token");

-- CreateIndex
CREATE INDEX "PassportUploadToken_token_expiresAt_idx" ON "PassportUploadToken"("token", "expiresAt");

-- CreateIndex
CREATE INDEX "PassportUploadToken_leadId_idx" ON "PassportUploadToken"("leadId");

-- AddForeignKey
ALTER TABLE "PassportUploadToken" ADD CONSTRAINT "PassportUploadToken_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "AffiliateLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
