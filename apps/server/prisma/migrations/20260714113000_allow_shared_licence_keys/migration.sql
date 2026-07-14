-- A business/TIN can have multiple distinct contacts. Phone number remains the lead identity.
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_licenceKey_key";

CREATE INDEX "Lead_licenceKey_idx" ON "Lead"("licenceKey");
