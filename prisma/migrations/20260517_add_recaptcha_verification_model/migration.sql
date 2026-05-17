-- CreateEnum
CREATE TYPE "RecaptchaVerificationStatus" AS ENUM ('PENDING', 'SUCCESS', 'BLOCKED', 'FAILED');

-- CreateTable
CREATE TABLE "RecaptchaVerification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT,
    "groupId" TEXT,
    "recaptchaToken" TEXT NOT NULL,
    "recaptchaScore" DOUBLE PRECISION NOT NULL,
    "verificationStatus" "RecaptchaVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMPTZ(6),
    "callbackStatus" TEXT,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecaptchaVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecaptchaVerification_organizationId_verificationStatus_idx" ON "RecaptchaVerification"("organizationId", "verificationStatus");

-- CreateIndex
CREATE INDEX "RecaptchaVerification_contactId_verificationStatus_idx" ON "RecaptchaVerification"("contactId", "verificationStatus");

-- CreateIndex
CREATE INDEX "RecaptchaVerification_expiresAt_idx" ON "RecaptchaVerification"("expiresAt");

-- CreateIndex
CREATE INDEX "RecaptchaVerification_createdAt_idx" ON "RecaptchaVerification"("createdAt");
