-- AlterTable Expense: Add missing fields for full expense tracking
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Expense' AND column_name='date') THEN
    ALTER TABLE "Expense" ADD COLUMN "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Expense' AND column_name='day') THEN
    ALTER TABLE "Expense" ADD COLUMN "day" INTEGER NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Expense' AND column_name='amount') THEN
    ALTER TABLE "Expense" ADD COLUMN "amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Expense' AND column_name='paymentMethod') THEN
    ALTER TABLE "Expense" ADD COLUMN "paymentMethod" VARCHAR(50) NOT NULL DEFAULT 'CASH';
  END IF;
END $$;

-- Add default constraint to currency column (it already exists)
ALTER TABLE "Expense" ALTER COLUMN "currency" SET DEFAULT 'KRW';

-- Add index for GET query optimization (userTripId, date)
CREATE INDEX IF NOT EXISTS "Expense_userTripId_date_idx" ON "Expense"("userTripId", "date");
