-- P0-6/7/8: Payment & GmReservation Contact 링크 추가

-- 1. Payment 테이블에 FK 컬럼 추가
ALTER TABLE "Payment" ADD COLUMN "contactId" TEXT,
ADD COLUMN "reservationId" INTEGER;

-- 2. GmReservation 테이블에 Contact FK 추가
ALTER TABLE "Reservation" ADD COLUMN "contactId" TEXT;

-- 3. Contact 테이블에 Product/Reservation FK 추가 (P0-1/2/3/4/5)
ALTER TABLE "Contact" ADD COLUMN "cruiseProductId" INTEGER,
ADD COLUMN "reservationId" INTEGER,
ADD COLUMN "preferredCabinType" TEXT,
ADD COLUMN "quotedPrice" INTEGER,
ADD COLUMN "priceAcceptedAt" TIMESTAMP(3);

-- 4. FK 인덱스 추가 (Payment)
CREATE INDEX "idx_payment_contact_id" ON "Payment"("contactId");
CREATE INDEX "idx_payment_reservation_id" ON "Payment"("reservationId");
CREATE INDEX "idx_payment_contact_reservation" ON "Payment"("contactId", "reservationId");

-- 5. FK 인덱스 추가 (GmReservation)
CREATE INDEX "idx_reservation_contact_id" ON "Reservation"("contactId");

-- 6. FK 인덱스 추가 (Contact)
CREATE INDEX "idx_contact_cruise_product_id" ON "Contact"("organizationId", "cruiseProductId");
CREATE INDEX "idx_contact_reservation_id" ON "Contact"("organizationId", "reservationId");
CREATE INDEX "idx_contact_quoted_price" ON "Contact"("organizationId", "quotedPrice");
CREATE INDEX "idx_contact_price_accepted" ON "Contact"("organizationId", "priceAcceptedAt");

-- 7. FK 제약 추가 (Payment -> Contact)
ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_contactId_fkey"
FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
ON DELETE SET NULL;

-- 8. FK 제약 추가 (Payment -> GmReservation)
ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
ON DELETE SET NULL;

-- 9. FK 제약 추가 (GmReservation -> Contact)
ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_contactId_fkey"
FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
ON DELETE SET NULL;

-- 10. FK 제약 추가 (Contact -> CruiseProduct)
ALTER TABLE "Contact"
ADD CONSTRAINT "Contact_cruiseProductId_fkey"
FOREIGN KEY ("cruiseProductId") REFERENCES "CruiseProduct"("id")
ON DELETE SET NULL;

-- 11. FK 제약 추가 (Contact -> GmReservation)
ALTER TABLE "Contact"
ADD CONSTRAINT "Contact_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
ON DELETE SET NULL;
