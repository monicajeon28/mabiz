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
