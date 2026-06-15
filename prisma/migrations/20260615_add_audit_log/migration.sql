-- AddTable ContractAuditLog
CREATE TABLE "ContractAuditLog" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "details" TEXT,

    CONSTRAINT "ContractAuditLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ContractAuditLog" ADD CONSTRAINT "ContractAuditLog_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ContractInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex for contractId (single-field lookups)
CREATE INDEX "idx_audit_contract" ON "ContractAuditLog"("contractId");

-- CreateIndex for timestamp (sorting)
CREATE INDEX "idx_audit_time" ON "ContractAuditLog"("timestamp");

-- CreateIndex for contractId + timestamp (combined lookups, most common case)
CREATE INDEX "idx_audit_contract_time" ON "ContractAuditLog"("contractId", "timestamp");
