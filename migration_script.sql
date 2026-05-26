-- P0-1/2/3/4/5: Add Contact product and reservation fields
ALTER TABLE "Contact" ADD COLUMN "cruiseProductId" INTEGER,
ADD COLUMN "reservationId" INTEGER,
ADD COLUMN "preferredCabinType" TEXT,
ADD COLUMN "quotedPrice" INTEGER,
ADD COLUMN "priceAcceptedAt" TIMESTAMP(3);

-- Add foreign key constraints
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_cruiseProductId_fkey" FOREIGN KEY ("cruiseProductId") REFERENCES "CruiseProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Contact" ADD CONSTRAINT "Contact_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX "idx_contact_cruise_product_id" ON "Contact"("organizationId", "cruiseProductId");
CREATE INDEX "idx_contact_reservation_id" ON "Contact"("organizationId", "reservationId");
CREATE INDEX "idx_contact_quoted_price" ON "Contact"("organizationId", "quotedPrice");
CREATE INDEX "idx_contact_price_accepted" ON "Contact"("organizationId", "priceAcceptedAt");

-- Record migration
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
  'c1fe945f-24d8-4b32-99b4-ca47d059633e',
  'abc1234567890def',
  NOW(),
  'add_contact_product_fields',
  '',
  NULL,
  NOW(),
  1
) ON CONFLICT DO NOTHING;
