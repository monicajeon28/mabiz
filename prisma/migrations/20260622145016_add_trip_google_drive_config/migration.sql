-- CreateTable TripGoogleDriveConfig
CREATE TABLE "TripGoogleDriveConfig" (
    "id" SERIAL NOT NULL,
    "tripId" INTEGER NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(6) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    "deletedAt" TIMESTAMP(6),
    "deletedBy" INTEGER,
    "deletedByName" TEXT,

    CONSTRAINT "TripGoogleDriveConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TripGoogleDriveConfig_tripId_key" ON "TripGoogleDriveConfig"("tripId");

-- CreateIndex
CREATE INDEX "TripGoogleDriveConfig_tripId_idx" ON "TripGoogleDriveConfig"("tripId");

-- CreateIndex
CREATE INDEX "TripGoogleDriveConfig_deletedAt_idx" ON "TripGoogleDriveConfig"("deletedAt");

-- AddForeignKey
ALTER TABLE "TripGoogleDriveConfig" ADD CONSTRAINT "TripGoogleDriveConfig_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
