-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "durationDays" INTEGER NOT NULL DEFAULT 14;
ALTER TABLE "Campaign" ADD COLUMN "startsAt" TIMESTAMPTZ(3);
ALTER TABLE "Campaign" ADD COLUMN "endsAt" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "Campaign_endsAt_idx" ON "Campaign"("endsAt");
