-- AddModel RecaptchaVerification
CREATE TABLE "RecaptchaVerification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT,
    "groupId" TEXT,
    "recaptchaToken" TEXT NOT NULL,
    "recaptchaScore" REAL NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMPTZ(6),
    "callbackStatus" TEXT,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecaptchaVerification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE,
    CONSTRAINT "RecaptchaVerification_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL,
    CONSTRAINT "RecaptchaVerification_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ContactGroup" ("id") ON DELETE SET NULL
);

-- CreateIndex
CREATE INDEX "RecaptchaVerification_organizationId_verificationStatus_idx" ON "RecaptchaVerification"("organizationId", "verificationStatus");

-- CreateIndex
CREATE INDEX "RecaptchaVerification_contactId_verificationStatus_idx" ON "RecaptchaVerification"("contactId", "verificationStatus");

-- CreateIndex
CREATE INDEX "RecaptchaVerification_expiresAt_idx" ON "RecaptchaVerification"("expiresAt");

-- CreateIndex
CREATE INDEX "RecaptchaVerification_createdAt_idx" ON "RecaptchaVerification"("createdAt");
