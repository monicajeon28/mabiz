-- CreateTable
CREATE TABLE "InclusionExclusionGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "includes" JSONB NOT NULL,
    "excludes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InclusionExclusionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InclusionExclusionGroup_name_idx" ON "InclusionExclusionGroup"("name");
