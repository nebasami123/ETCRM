-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'LEAD_UPDATED';

-- One open transfer request per lead (partial unique index).
CREATE UNIQUE INDEX "ClaimTransferRequest_leadId_pending_key"
ON "ClaimTransferRequest" ("leadId")
WHERE "status" = 'PENDING';
