-- P0-ISS-02: Contact UPSERT 멱등성 강화
-- bookingRef + organizationId 기준 중복 방지 (동시 결제 Race condition 해결)

ALTER TABLE "Contact"
ADD CONSTRAINT "uq_contact_booking_org" UNIQUE ("bookingRef", "organizationId");

-- INDEX 추가 (쿼리 성능)
CREATE INDEX "idx_contact_booking" ON "Contact"("bookingRef");
CREATE INDEX "idx_contact_booking_org" ON "Contact"("bookingRef", "organizationId");
