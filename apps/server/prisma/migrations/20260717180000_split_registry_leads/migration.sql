-- Split directory-sourced leads into RegistryLead + LeadPhoneIndex; polymorphic activity/transfers.

CREATE TYPE "LeadKind" AS ENUM ('LOCAL', 'REGISTRY');

-- RegistryLead shell table
CREATE TABLE "RegistryLead" (
    "id" TEXT NOT NULL,
    "externalBusinessId" TEXT NOT NULL,
    "phoneKey" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "regionKey" TEXT,
    "subcityKey" TEXT,
    "sectorKey" TEXT,
    "phase" "LeadPhase" NOT NULL DEFAULT 'NEW',
    "createdById" TEXT,
    "claimedById" TEXT,
    "claimedAt" TIMESTAMPTZ(3),
    "appointmentDate" TIMESTAMPTZ(3),
    "nextFollowUpAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistryLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistryLead_phoneKey_key" ON "RegistryLead"("phoneKey");
CREATE UNIQUE INDEX "RegistryLead_externalBusinessId_phoneKey_key" ON "RegistryLead"("externalBusinessId", "phoneKey");
CREATE INDEX "RegistryLead_externalBusinessId_idx" ON "RegistryLead"("externalBusinessId");
CREATE INDEX "RegistryLead_phase_idx" ON "RegistryLead"("phase");
CREATE INDEX "RegistryLead_claimedById_idx" ON "RegistryLead"("claimedById");
CREATE INDEX "RegistryLead_createdById_idx" ON "RegistryLead"("createdById");
CREATE INDEX "RegistryLead_nextFollowUpAt_idx" ON "RegistryLead"("nextFollowUpAt");
CREATE INDEX "RegistryLead_appointmentDate_idx" ON "RegistryLead"("appointmentDate");
CREATE INDEX "RegistryLead_regionKey_idx" ON "RegistryLead"("regionKey");
CREATE INDEX "RegistryLead_subcityKey_idx" ON "RegistryLead"("subcityKey");
CREATE INDEX "RegistryLead_sectorKey_idx" ON "RegistryLead"("sectorKey");
CREATE INDEX "RegistryLead_displayName_idx" ON "RegistryLead"("displayName");

ALTER TABLE "RegistryLead" ADD CONSTRAINT "RegistryLead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RegistryLead" ADD CONSTRAINT "RegistryLead_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Move existing MONGO rows into RegistryLead (same ids to preserve activity FKs)
INSERT INTO "RegistryLead" (
  "id", "externalBusinessId", "phoneKey", "phoneNumber", "displayName",
  "regionKey", "subcityKey", "sectorKey", "phase", "createdById", "claimedById",
  "claimedAt", "appointmentDate", "nextFollowUpAt", "createdAt", "updatedAt"
)
SELECT
  "id",
  COALESCE("mongoBusinessId", ''),
  "phoneKey",
  "phoneNumber",
  "fullName",
  "businessRegion",
  "businessWoreda",
  "englishDescription",
  "phase",
  "createdById",
  "claimedById",
  "claimedAt",
  "appointmentDate",
  "nextFollowUpAt",
  "createdAt",
  "updatedAt"
FROM "Lead"
WHERE "source" = 'MONGO';

-- Phone index for all leads
CREATE TABLE "LeadPhoneIndex" (
    "phoneKey" TEXT NOT NULL,
    "kind" "LeadKind" NOT NULL,
    "leadId" TEXT NOT NULL,

    CONSTRAINT "LeadPhoneIndex_pkey" PRIMARY KEY ("phoneKey")
);

CREATE INDEX "LeadPhoneIndex_kind_leadId_idx" ON "LeadPhoneIndex"("kind", "leadId");

INSERT INTO "LeadPhoneIndex" ("phoneKey", "kind", "leadId")
SELECT "phoneKey", 'LOCAL'::"LeadKind", "id" FROM "Lead" WHERE "source" IS DISTINCT FROM 'MONGO';

INSERT INTO "LeadPhoneIndex" ("phoneKey", "kind", "leadId")
SELECT "phoneKey", 'REGISTRY'::"LeadKind", "id" FROM "RegistryLead"
ON CONFLICT ("phoneKey") DO NOTHING;

-- ActivityEvent: polymorphic
ALTER TABLE "ActivityEvent" DROP CONSTRAINT IF EXISTS "ActivityEvent_leadId_fkey";
ALTER TABLE "ActivityEvent" ADD COLUMN "leadKind" "LeadKind";

UPDATE "ActivityEvent" ae
SET "leadKind" = CASE
  WHEN EXISTS (SELECT 1 FROM "RegistryLead" rl WHERE rl."id" = ae."leadId") THEN 'REGISTRY'::"LeadKind"
  WHEN ae."leadId" IS NOT NULL THEN 'LOCAL'::"LeadKind"
  ELSE NULL
END;

DROP INDEX IF EXISTS "ActivityEvent_leadId_createdAt_idx";
CREATE INDEX "ActivityEvent_leadKind_leadId_createdAt_idx" ON "ActivityEvent"("leadKind", "leadId", "createdAt");

-- ClaimTransferRequest: polymorphic
ALTER TABLE "ClaimTransferRequest" DROP CONSTRAINT IF EXISTS "ClaimTransferRequest_leadId_fkey";
ALTER TABLE "ClaimTransferRequest" ADD COLUMN "leadKind" "LeadKind";

UPDATE "ClaimTransferRequest" ctr
SET "leadKind" = CASE
  WHEN EXISTS (SELECT 1 FROM "RegistryLead" rl WHERE rl."id" = ctr."leadId") THEN 'REGISTRY'::"LeadKind"
  ELSE 'LOCAL'::"LeadKind"
END;

ALTER TABLE "ClaimTransferRequest" ALTER COLUMN "leadKind" SET NOT NULL;

DROP INDEX IF EXISTS "ClaimTransferRequest_leadId_status_idx";
CREATE INDEX "ClaimTransferRequest_leadKind_leadId_status_idx" ON "ClaimTransferRequest"("leadKind", "leadId", "status");

-- Drop old partial unique on leadId only; recreate including kind
DROP INDEX IF EXISTS "ClaimTransferRequest_one_pending_per_lead";
CREATE UNIQUE INDEX "ClaimTransferRequest_one_pending_per_lead"
  ON "ClaimTransferRequest" ("leadKind", "leadId")
  WHERE "status" = 'PENDING';

-- CampaignLead: polymorphic + rename mongoBusinessId
ALTER TABLE "CampaignLead" DROP CONSTRAINT IF EXISTS "CampaignLead_leadId_fkey";
ALTER TABLE "CampaignLead" ADD COLUMN "leadKind" "LeadKind";
ALTER TABLE "CampaignLead" ADD COLUMN "externalBusinessId" TEXT;

UPDATE "CampaignLead"
SET
  "externalBusinessId" = "mongoBusinessId",
  "leadKind" = CASE
    WHEN "leadId" IS NULL THEN NULL
    WHEN EXISTS (SELECT 1 FROM "RegistryLead" rl WHERE rl."id" = "CampaignLead"."leadId") THEN 'REGISTRY'::"LeadKind"
    ELSE 'LOCAL'::"LeadKind"
  END;

ALTER TABLE "CampaignLead" DROP COLUMN IF EXISTS "mongoBusinessId";
DROP INDEX IF EXISTS "CampaignLead_leadId_idx";
CREATE INDEX "CampaignLead_leadKind_leadId_idx" ON "CampaignLead"("leadKind", "leadId");

-- Remove migrated MONGO rows from Lead
DELETE FROM "Lead" WHERE "source" = 'MONGO';

-- Strip source/mongo columns from Lead
DROP INDEX IF EXISTS "Lead_source_idx";
DROP INDEX IF EXISTS "Lead_mongoBusinessId_idx";
DROP INDEX IF EXISTS "Lead_mongoBusinessId_phoneKey_key";
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "source";
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "mongoBusinessId";

DROP TYPE IF EXISTS "LeadSource";
