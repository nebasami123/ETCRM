ALTER TABLE "Lead"
ADD COLUMN "pipelineStage" TEXT,
ADD COLUMN "leadSource" TEXT;

ALTER TABLE "RegistryLead"
ADD COLUMN "pipelineStage" TEXT,
ADD COLUMN "leadSource" TEXT;
