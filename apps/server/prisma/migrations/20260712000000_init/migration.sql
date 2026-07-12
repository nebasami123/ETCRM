-- Canonical PostgreSQL schema for ETCRM. Generated from schema.prisma and reviewed.
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "LeadPhase" AS ENUM ('NEW', 'CONTACTED', 'FOLLOW_UP', 'CLOSED_WON', 'CLOSED_LOST');
CREATE TYPE "ActivityType" AS ENUM ('LEAD_CREATED', 'LEAD_IMPORTED', 'LEAD_CLAIMED', 'CLAIM_TRANSFER_REQUESTED', 'CLAIM_TRANSFER_APPROVED', 'CLAIM_TRANSFER_REJECTED', 'CALL_NOTE', 'PHASE_CHANGED', 'APPOINTMENT_SET', 'FOLLOW_UP_SET');
CREATE TYPE "ClaimRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "image" TEXT,
  "role" TEXT NOT NULL DEFAULT 'SALES',
  "banned" BOOLEAN DEFAULT false,
  "banReason" TEXT,
  "banExpires" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL
);

CREATE TABLE "Session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "impersonatedBy" TEXT
);
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

CREATE TABLE "Account" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ(3),
  "refreshTokenExpiresAt" TIMESTAMPTZ(3),
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Account_providerId_accountId_key" UNIQUE ("providerId", "accountId")
);
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

CREATE TABLE "Verification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

CREATE TABLE "Lead" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "fullName" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "phoneKey" TEXT NOT NULL UNIQUE,
  "email" TEXT NOT NULL DEFAULT '',
  "phase" "LeadPhase" NOT NULL DEFAULT 'NEW',
  "createdById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "claimedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "claimedAt" TIMESTAMPTZ(3),
  "appointmentDate" TIMESTAMPTZ(3),
  "nextFollowUpAt" TIMESTAMPTZ(3),
  "dateRegistered" TIMESTAMPTZ(3),
  "legalStatusNameEng" TEXT,
  "legalStatusNameAmh" TEXT,
  "status" TEXT,
  "licenceNumber" TEXT,
  "licenceKey" TEXT UNIQUE,
  "renewedTo" TIMESTAMPTZ(3),
  "siteId" TEXT,
  "businessName" TEXT,
  "businessNameAmharic" TEXT,
  "managerFName" TEXT,
  "managerMName" TEXT,
  "managerLName" TEXT,
  "description" TEXT,
  "code" TEXT,
  "englishDescription" TEXT,
  "amDescription" TEXT,
  "subGroup" TEXT,
  "subGroupAm" TEXT,
  "subGroupEn" TEXT,
  "businessRegion" TEXT,
  "businessZone" TEXT,
  "businessWoreda" TEXT,
  "businessKebele" TEXT,
  "houseNumber" TEXT,
  "businessTelephone" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "Lead_phase_idx" ON "Lead"("phase");
CREATE INDEX "Lead_claimedById_idx" ON "Lead"("claimedById");
CREATE INDEX "Lead_createdById_idx" ON "Lead"("createdById");
CREATE INDEX "Lead_nextFollowUpAt_idx" ON "Lead"("nextFollowUpAt");
CREATE INDEX "Lead_appointmentDate_idx" ON "Lead"("appointmentDate");

CREATE TABLE "ActivityEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "leadId" TEXT REFERENCES "Lead"("id") ON DELETE CASCADE,
  "actorId" TEXT NOT NULL REFERENCES "User"("id"),
  "creditedUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "type" "ActivityType" NOT NULL,
  "note" TEXT,
  "fromPhase" "LeadPhase",
  "toPhase" "LeadPhase",
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ActivityEvent_leadId_createdAt_idx" ON "ActivityEvent"("leadId", "createdAt");
CREATE INDEX "ActivityEvent_actorId_createdAt_idx" ON "ActivityEvent"("actorId", "createdAt");
CREATE INDEX "ActivityEvent_creditedUserId_createdAt_idx" ON "ActivityEvent"("creditedUserId", "createdAt");
CREATE INDEX "ActivityEvent_type_createdAt_idx" ON "ActivityEvent"("type", "createdAt");

CREATE TABLE "ClaimTransferRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "leadId" TEXT NOT NULL REFERENCES "Lead"("id") ON DELETE CASCADE,
  "requestedById" TEXT NOT NULL REFERENCES "User"("id"),
  "status" "ClaimRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT NOT NULL,
  "resolvedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "resolvedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ClaimTransferRequest_leadId_status_idx" ON "ClaimTransferRequest"("leadId", "status");
CREATE INDEX "ClaimTransferRequest_requestedById_status_idx" ON "ClaimTransferRequest"("requestedById", "status");

CREATE TABLE "Quota" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "salesUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "date" DATE NOT NULL,
  "callsTarget" INTEGER NOT NULL DEFAULT 0,
  "leadsTarget" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Quota_salesUserId_date_key" UNIQUE ("salesUserId", "date")
);
CREATE INDEX "Quota_date_idx" ON "Quota"("date");
