-- AddForeignKey Contact.userId -> GmUser.id
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey GmReservation.tripId -> GmTrip.id
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey GmReservation.mainUserId -> GmUser.id (with CASCADE)
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_mainUserId_fkey" FOREIGN KEY ("mainUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
