-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('LOCAL', 'MONGO');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "source" "LeadSource" NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "Lead" ADD COLUMN "mongoBusinessId" TEXT;

-- CreateIndex
CREATE INDEX "Lead_source_idx" ON "Lead"("source");
CREATE INDEX "Lead_mongoBusinessId_idx" ON "Lead"("mongoBusinessId");
CREATE INDEX "Lead_businessRegion_idx" ON "Lead"("businessRegion");
CREATE INDEX "Lead_businessWoreda_idx" ON "Lead"("businessWoreda");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_mongoBusinessId_phoneKey_key" ON "Lead"("mongoBusinessId", "phoneKey");
