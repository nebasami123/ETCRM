import { ActivityType, ClaimRequestStatus, LeadPhase, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { parseOptionalDate } from "../../utils/dates.js";
import { buildLead, prepareLeadImport, readLeadRows, removeUpload, type SkippedLeadRow } from "./leadImportService.js";
import { leadDetailInclude, licenceKey, phoneKey } from "./leadService.js";

type Db = Prisma.TransactionClient;

export type LeadInput = {
  fullName: string;
  phoneNumber: string;
  email?: string;
  appointmentDate?: string | null;
  nextFollowUpAt?: string | null;
  businessName?: string;
  licenceNumber?: string;
  businessRegion?: string;
  businessZone?: string;
  businessWoreda?: string;
  businessKebele?: string;
  houseNumber?: string;
  businessTelephone?: string;
};

function leadData(input: LeadInput, actorId: string, claimActor: boolean): Prisma.LeadUncheckedCreateInput {
  const licenceNumber = input.licenceNumber?.trim() || null;
  return {
    fullName: input.fullName.trim(),
    phoneNumber: input.phoneNumber.trim(),
    phoneKey: phoneKey(input.phoneNumber),
    email: input.email?.trim() || "",
    licenceNumber,
    licenceKey: licenceKey(licenceNumber),
    createdById: actorId,
    claimedById: claimActor ? actorId : null,
    claimedAt: claimActor ? new Date() : null,
    appointmentDate: parseOptionalDate(input.appointmentDate),
    nextFollowUpAt: parseOptionalDate(input.nextFollowUpAt),
    businessName: input.businessName?.trim() || null,
    businessRegion: input.businessRegion?.trim() || null,
    businessZone: input.businessZone?.trim() || null,
    businessWoreda: input.businessWoreda?.trim() || null,
    businessKebele: input.businessKebele?.trim() || null,
    houseNumber: input.houseNumber?.trim() || null,
    businessTelephone: input.businessTelephone?.trim() || null
  };
}

async function event(db: Db, input: Prisma.ActivityEventUncheckedCreateInput) {
  return db.activityEvent.create({ data: input });
}

export async function createLead({ input, actorId, claimActor = false }: { input: LeadInput; actorId: string; claimActor?: boolean }) {
  const data = leadData(input, actorId, claimActor);
  return prisma.$transaction(async (db) => {
    const duplicate = await db.lead.findFirst({
      where: { OR: [{ phoneKey: data.phoneKey }, ...(data.licenceKey ? [{ licenceKey: data.licenceKey }] : [])] },
      select: { id: true, fullName: true, phoneNumber: true, licenceNumber: true }
    });
    if (duplicate) return { status: "duplicate" as const, duplicate };

    const lead = await db.lead.create({ data, include: leadDetailInclude });
    await event(db, { actorId, leadId: lead.id, type: ActivityType.LEAD_CREATED, metadata: { claimedOnCreate: claimActor } });
    if (claimActor) await event(db, { actorId, leadId: lead.id, type: ActivityType.LEAD_CLAIMED });
    return { status: "ok" as const, lead };
  });
}

export async function importLeads({ file, actorId, claimActor = false, source }: { file: Express.Multer.File; actorId: string; claimActor?: boolean; source: "admin-upload" | "sales-upload" }) {
  try {
    const rows = await readLeadRows(file);
    const candidates = rows.map((row, index) => ({ rowNumber: index + 2, lead: buildLead(row, { createdById: actorId }) }));
    return await prisma.$transaction(async (db) => {
      const { leads, skipped } = await prepareLeadImport(db, candidates);
      if (!leads.length) return { status: "empty" as const, imported: 0, skipped: skipped.length, skippedRows: skipped.slice(0, 25) };
      const now = new Date();
      await db.lead.createMany({ data: leads.map((lead) => ({ ...lead, claimedById: claimActor ? actorId : null, claimedAt: claimActor ? now : null })) });
      await event(db, { actorId, type: ActivityType.LEAD_IMPORTED, metadata: { source, imported: leads.length, skipped: skipped.length } });
      return { status: "ok" as const, imported: leads.length, skipped: skipped.length, skippedRows: skipped.slice(0, 25) };
    });
  } finally {
    await removeUpload(file);
  }
}

export async function claimLead({ leadId, actorId }: { leadId: string; actorId: string }) {
  return prisma.$transaction(async (db) => {
    const claimed = await db.lead.updateMany({ where: { id: leadId, claimedById: null }, data: { claimedById: actorId, claimedAt: new Date() } });
    if (claimed.count === 0) {
      const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, claimedById: true } });
      return lead ? { status: "already-claimed" as const, claimedById: lead.claimedById } : { status: "not-found" as const };
    }
    await event(db, { actorId, leadId, type: ActivityType.LEAD_CLAIMED });
    return { status: "ok" as const, lead: await db.lead.findUniqueOrThrow({ where: { id: leadId }, include: leadDetailInclude }) };
  });
}

export async function requestClaimTransfer({ leadId, actorId, reason }: { leadId: string; actorId: string; reason: string }) {
  return prisma.$transaction(async (db) => {
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, claimedById: true } });
    if (!lead) return { status: "not-found" as const };
    if (!lead.claimedById) return { status: "unclaimed" as const };
    if (lead.claimedById === actorId) return { status: "already-claimer" as const };
    const request = await db.claimTransferRequest.create({ data: { leadId, requestedById: actorId, reason } });
    await event(db, { actorId, leadId, type: ActivityType.CLAIM_TRANSFER_REQUESTED, metadata: { requestId: request.id, currentClaimerId: lead.claimedById } });
    return { status: "ok" as const, request };
  });
}

export async function resolveClaimTransfer({ requestId, adminId, approve }: { requestId: string; adminId: string; approve: boolean }) {
  return prisma.$transaction(async (db) => {
    const request = await db.claimTransferRequest.findUnique({ where: { id: requestId }, include: { lead: true } });
    if (!request || request.status !== ClaimRequestStatus.PENDING) return null;
    const status = approve ? ClaimRequestStatus.APPROVED : ClaimRequestStatus.REJECTED;
    await db.claimTransferRequest.update({ where: { id: requestId }, data: { status, resolvedById: adminId, resolvedAt: new Date() } });
    if (approve) {
      await db.lead.update({ where: { id: request.leadId }, data: { claimedById: request.requestedById, claimedAt: new Date() } });
    }
    await event(db, { actorId: adminId, leadId: request.leadId, type: approve ? ActivityType.CLAIM_TRANSFER_APPROVED : ActivityType.CLAIM_TRANSFER_REJECTED, metadata: { requestId, requestedById: request.requestedById } });
    return db.lead.findUniqueOrThrow({ where: { id: request.leadId }, include: leadDetailInclude });
  });
}

export async function setLeadClaim({ leadId, adminId, salesUserId }: { leadId: string; adminId: string; salesUserId: string | null }) {
  return prisma.$transaction(async (db) => {
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true } });
    if (!lead) return null;
    const updated = await db.lead.update({
      where: { id: leadId },
      data: { claimedById: salesUserId, claimedAt: salesUserId ? new Date() : null },
      include: leadDetailInclude
    });
    await event(db, { actorId: adminId, leadId, type: ActivityType.LEAD_CLAIMED, metadata: { claimedById: salesUserId, source: "admin" } });
    return updated;
  });
}

export async function updateLeadPhase({ leadId, actorId, phase, creditedUserId }: { leadId: string; actorId: string; phase: LeadPhase; creditedUserId?: string | null }) {
  return prisma.$transaction(async (db) => {
    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) return null;
    const updated = await db.lead.update({ where: { id: leadId }, data: { phase }, include: leadDetailInclude });
    await event(db, { actorId, leadId, type: ActivityType.PHASE_CHANGED, fromPhase: lead.phase, toPhase: phase, creditedUserId: phase === LeadPhase.CLOSED_WON ? creditedUserId || actorId : null });
    return updated;
  });
}

export async function addCallNote({ leadId, actorId, note }: { leadId: string; actorId: string; note: string }) {
  return prisma.$transaction(async (db) => {
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true } });
    if (!lead) return null;
    await event(db, { actorId, leadId, type: ActivityType.CALL_NOTE, note });
    return db.lead.findUniqueOrThrow({ where: { id: leadId }, include: leadDetailInclude });
  });
}

export async function updateLeadSchedule({ leadId, actorId, kind, value }: { leadId: string; actorId: string; kind: "appointment" | "follow-up"; value: string | null | undefined }) {
  const date = parseOptionalDate(value);
  return prisma.$transaction(async (db) => {
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true } });
    if (!lead) return null;
    const updated = await db.lead.update({
      where: { id: leadId },
      data: kind === "appointment" ? { appointmentDate: date } : { nextFollowUpAt: date },
      include: leadDetailInclude
    });
    await event(db, { actorId, leadId, type: kind === "appointment" ? ActivityType.APPOINTMENT_SET : ActivityType.FOLLOW_UP_SET, metadata: { value: date } });
    return updated;
  });
}

export async function updateLead({ leadId, input, actorId }: { leadId: string; input: LeadInput; actorId: string }) {
  const licenceNumber = input.licenceNumber?.trim() || null;
  const pKey = phoneKey(input.phoneNumber);
  const lKey = licenceKey(licenceNumber);

  return prisma.$transaction(async (db) => {
    const existing = await db.lead.findUnique({ where: { id: leadId } });
    if (!existing) return { status: "not-found" as const };

    const duplicate = await db.lead.findFirst({
      where: {
        id: { not: leadId },
        OR: [
          { phoneKey: pKey },
          ...(lKey ? [{ licenceKey: lKey }] : [])
        ]
      },
      select: { id: true, fullName: true, phoneNumber: true, licenceNumber: true }
    });
    if (duplicate) return { status: "duplicate" as const, duplicate };

    const updated = await db.lead.update({
      where: { id: leadId },
      data: {
        fullName: input.fullName.trim(),
        phoneNumber: input.phoneNumber.trim(),
        phoneKey: pKey,
        email: input.email?.trim() || "",
        licenceNumber,
        licenceKey: lKey,
        appointmentDate: parseOptionalDate(input.appointmentDate),
        nextFollowUpAt: parseOptionalDate(input.nextFollowUpAt),
        businessName: input.businessName?.trim() || null,
        businessRegion: input.businessRegion?.trim() || null,
        businessZone: input.businessZone?.trim() || null,
        businessWoreda: input.businessWoreda?.trim() || null,
        businessKebele: input.businessKebele?.trim() || null,
        houseNumber: input.houseNumber?.trim() || null,
        businessTelephone: input.businessTelephone?.trim() || null
      },
      include: leadDetailInclude
    });

    // Write a call note activity event log to document the administrative details update
    await event(db, { actorId, leadId, type: ActivityType.CALL_NOTE, note: `Lead details updated by Administrator` });

    return { status: "ok" as const, lead: updated };
  });
}

export type ImportResult = { status: "ok" | "empty"; imported: number; skipped: number; skippedRows: SkippedLeadRow[] };

