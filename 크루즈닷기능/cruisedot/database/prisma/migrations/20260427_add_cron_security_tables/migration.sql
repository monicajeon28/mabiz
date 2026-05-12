-- P1-HIGH: 분산 Lock (CRON 동시성 방지)
CREATE TABLE "cron_locks" (
  "id" SERIAL NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "cron_locks_key_expiresAt_idx" ON "cron_locks"("key", "expiresAt");

-- P1-HIGH: Rate Limiting (CRON 엔드포인트 보호)
CREATE TABLE "cron_rate_limit_logs" (
  "id" SERIAL NOT NULL PRIMARY KEY,
  "clientIp" VARCHAR(50) NOT NULL,
  "endpoint" VARCHAR(200) NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "cron_rate_limit_logs_clientIp_endpoint_timestamp_idx" ON "cron_rate_limit_logs"("clientIp", "endpoint", "timestamp");
