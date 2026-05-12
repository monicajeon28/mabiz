-- Add PaymentStatus enum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'completed', 'failed', 'cancelled', 'refunded', 'partial_refunded', 'refund_pending', 'pending_vbank');

-- Change Payment.status column type from String to PaymentStatus enum
ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'pending'::"PaymentStatus";
ALTER TABLE "Payment" ALTER COLUMN "status" TYPE "PaymentStatus" USING "status"::"PaymentStatus";
