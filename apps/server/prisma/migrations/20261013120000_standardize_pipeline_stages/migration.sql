UPDATE "Lead"
SET "pipelineStage" = CASE
  WHEN "pipelineStage" IN ('Lead', 'Contacted', 'Meeting Booked', 'Showed Up', 'Qualified', 'Demo / Presentation', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost') THEN "pipelineStage"
  WHEN "phase" = 'NEW' THEN 'Lead'
  WHEN "phase" = 'CONTACTED' THEN 'Contacted'
  WHEN "phase" = 'CLOSED_WON' THEN 'Closed Won'
  WHEN "phase" = 'CLOSED_LOST' THEN 'Closed Lost'
  ELSE 'Meeting Booked'
END;

UPDATE "RegistryLead"
SET "pipelineStage" = CASE
  WHEN "pipelineStage" IN ('Lead', 'Contacted', 'Meeting Booked', 'Showed Up', 'Qualified', 'Demo / Presentation', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost') THEN "pipelineStage"
  WHEN "phase" = 'NEW' THEN 'Lead'
  WHEN "phase" = 'CONTACTED' THEN 'Contacted'
  WHEN "phase" = 'CLOSED_WON' THEN 'Closed Won'
  WHEN "phase" = 'CLOSED_LOST' THEN 'Closed Lost'
  ELSE 'Meeting Booked'
END;

ALTER TABLE "Lead"
  ALTER COLUMN "pipelineStage" SET DEFAULT 'Lead',
  ALTER COLUMN "pipelineStage" SET NOT NULL,
  ADD CONSTRAINT "Lead_pipelineStage_allowed" CHECK ("pipelineStage" IN ('Lead', 'Contacted', 'Meeting Booked', 'Showed Up', 'Qualified', 'Demo / Presentation', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'));

ALTER TABLE "RegistryLead"
  ALTER COLUMN "pipelineStage" SET DEFAULT 'Lead',
  ALTER COLUMN "pipelineStage" SET NOT NULL,
  ADD CONSTRAINT "RegistryLead_pipelineStage_allowed" CHECK ("pipelineStage" IN ('Lead', 'Contacted', 'Meeting Booked', 'Showed Up', 'Qualified', 'Demo / Presentation', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'));
