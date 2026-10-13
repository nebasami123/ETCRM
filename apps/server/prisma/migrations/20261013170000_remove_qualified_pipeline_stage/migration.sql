BEGIN;

-- Retire the stage without deleting leads or changing their activity history.
UPDATE "Lead" SET "pipelineStage" = 'Demo / Presentation' WHERE "pipelineStage" = 'Qualified';
UPDATE "RegistryLead" SET "pipelineStage" = 'Demo / Presentation' WHERE "pipelineStage" = 'Qualified';

ALTER TABLE "Lead" DROP CONSTRAINT "Lead_pipelineStage_allowed";
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_pipelineStage_allowed"
  CHECK ("pipelineStage" IN ('Lead', 'Contacted', 'Meeting Booked', 'Showed Up', 'Demo / Presentation', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'));

ALTER TABLE "RegistryLead" DROP CONSTRAINT "RegistryLead_pipelineStage_allowed";
ALTER TABLE "RegistryLead" ADD CONSTRAINT "RegistryLead_pipelineStage_allowed"
  CHECK ("pipelineStage" IN ('Lead', 'Contacted', 'Meeting Booked', 'Showed Up', 'Demo / Presentation', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'));

COMMIT;
