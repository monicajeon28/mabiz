-- O-3: Push Notification Tables
CREATE TABLE "UserDevice" (
  "id" SERIAL NOT NULL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "platform" TEXT NOT NULL,
  "deviceToken" TEXT NOT NULL UNIQUE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "UserDevice_userId_deviceToken_key" ON "UserDevice"("userId", "deviceToken");
CREATE INDEX "UserDevice_userId_isActive_idx" ON "UserDevice"("userId", "isActive");
CREATE INDEX "UserDevice_isActive_registeredAt_idx" ON "UserDevice"("isActive", "registeredAt");

CREATE TABLE "PushLog" (
  "id" SERIAL NOT NULL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "deepLink" TEXT,
  "data" JSONB,
  "status" TEXT NOT NULL DEFAULT 'SENT',
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "openedAt" TIMESTAMP(3),
  "clickedAt" TIMESTAMP(3),
  CONSTRAINT "PushLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE INDEX "PushLog_userId_sentAt_idx" ON "PushLog"("userId", "sentAt");
CREATE INDEX "PushLog_status_sentAt_idx" ON "PushLog"("status", "sentAt");
CREATE INDEX "PushLog_userId_status_idx" ON "PushLog"("userId", "status");

-- I-5: Newsletter Tables
CREATE TABLE "EmailPreference" (
  "id" SERIAL NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "userId" INTEGER,
  "categories" TEXT[] NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unsubscribedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE INDEX "EmailPreference_email_isActive_idx" ON "EmailPreference"("email", "isActive");
CREATE INDEX "EmailPreference_userId_idx" ON "EmailPreference"("userId");
CREATE INDEX "EmailPreference_isActive_subscribedAt_idx" ON "EmailPreference"("isActive", "subscribedAt");

CREATE TABLE "NewsletterLog" (
  "id" SERIAL NOT NULL PRIMARY KEY,
  "subject" TEXT NOT NULL,
  "htmlContent" TEXT NOT NULL,
  "recipientSegment" TEXT NOT NULL,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "openedCount" INTEGER NOT NULL DEFAULT 0,
  "clickedCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "unsubscribeCount" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scheduledAt" TIMESTAMP(3)
);

CREATE INDEX "NewsletterLog_sentAt_idx" ON "NewsletterLog"("sentAt");
CREATE INDEX "NewsletterLog_recipientSegment_sentAt_idx" ON "NewsletterLog"("recipientSegment", "sentAt");
