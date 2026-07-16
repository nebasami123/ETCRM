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

function summarizeSkippedRows(skipped: SkippedLeadRow[]) {
  const counts = new Map<string, number>();
  for (const { reason } of skipped) counts.set(reason, (counts.get(reason) || 0) + 1);
  return [...counts].map(([reason, count]) => ({ reason, count }));
}

export function importEmptyMessage(result: Pick<ImportResult, "skipped" | "skippedByReason">) {
  const breakdown = result.skippedByReason.map(({ reason, count }) => `${count} ${reason}`).join("; ");
  return `No new leads were imported. All ${result.skipped} rows were skipped: ${breakdown || "no valid rows"}.`;
}

export async function createLead({ input, actorId, claimActor = false }: { input: LeadInput; actorId: string; claimActor?: boolean }) {
  const data = leadData(input, actorId, claimActor);
  return prisma.$transaction(async (db) => {
    const duplicate = await db.lead.findFirst({
      where: { phoneKey: data.phoneKey },
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
      let skippedByReason = summarizeSkippedRows(skipped);
      if (!leads.length) return { status: "empty" as const, imported: 0, skipped: skipped.length, skippedRows: skipped.slice(0, 25), skippedByReason };
      const now = new Date();
      const inserted = await db.lead.createMany({ data: leads.map((lead) => ({ ...lead, claimedById: claimActor ? actorId : null, claimedAt: claimActor ? now : null })), skipDuplicates: true });
      const writeConflicts = leads.length - inserted.count;
      if (writeConflicts) skipped.push(...Array.from({ length: writeConflicts }, () => ({ row: 0, reason: "Already exists in CRM" })));
      skippedByReason = summarizeSkippedRows(skipped);
      if (!inserted.count) return { status: "empty" as const, imported: 0, skipped: skipped.length, skippedRows: skipped.slice(0, 25), skippedByReason };
      await event(db, { actorId, type: ActivityType.LEAD_IMPORTED, metadata: { source, imported: inserted.count, skipped: skipped.length } });
      return { status: "ok" as const, imported: inserted.count, skipped: skipped.length, skippedRows: skipped.slice(0, 25), skippedByReason };
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

    const pending = await db.claimTransferRequest.findFirst({
      where: { leadId, status: ClaimRequestStatus.PENDING },
      select: { id: true }
    });
    if (pending) return { status: "pending-exists" as const, requestId: pending.id };

    try {
      const request = await db.claimTransferRequest.create({ data: { leadId, requestedById: actorId, reason } });
      await event(db, { actorId, leadId, type: ActivityType.CLAIM_TRANSFER_REQUESTED, metadata: { requestId: request.id, currentClaimerId: lead.claimedById } });
      return { status: "ok" as const, request };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { status: "pending-exists" as const };
      }
      throw error;
    }
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

/**
 * Ownership policy (sales mutations):
 * - Phase, appointment, follow-up, and call notes require the actor to be the current claimer.
 * - Unclaimed leads and other reps' leads cannot be mutated; claim or request a transfer first.
 * - Admins use setLeadClaim / updateLead / updateLeadPhase without this claimer check (separate entry points).
 */
async function requireClaimer(db: Db, leadId: string, actorId: string) {
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, claimedById: true, phase: true } });
  if (!lead) return { status: "not-found" as const };
  if (lead.claimedById !== actorId) return { status: "forbidden" as const, claimedById: lead.claimedById };
  return { status: "ok" as const, lead };
}

export async function updateLeadPhase({
  leadId,
  actorId,
  phase,
  creditedUserId,
  requireOwnership = false
}: {
  leadId: string;
  actorId: string;
  phase: LeadPhase;
  creditedUserId?: string | null;
  /** When true (sales path), only the claimer may change phase. */
  requireOwnership?: boolean;
}) {
  return prisma.$transaction(async (db) => {
    if (requireOwnership) {
      const ownership = await requireClaimer(db, leadId, actorId);
      if (ownership.status === "not-found") return { status: "not-found" as const };
      if (ownership.status === "forbidden") return { status: "forbidden" as const, claimedById: ownership.claimedById };
    } else {
      const lead = await db.lead.findUnique({ where: { id: leadId } });
      if (!lead) return { status: "not-found" as const };
    }

    const existing = await db.lead.findUnique({ where: { id: leadId } });
    if (!existing) return { status: "not-found" as const };

    const updated = await db.lead.update({ where: { id: leadId }, data: { phase }, include: leadDetailInclude });
    await event(db, {
      actorId,
      leadId,
      type: ActivityType.PHASE_CHANGED,
      fromPhase: existing.phase,
      toPhase: phase,
      creditedUserId: phase === LeadPhase.CLOSED_WON ? creditedUserId || actorId : null
    });
    return { status: "ok" as const, lead: updated };
  });
}

export async function addCallNote({
  leadId,
  actorId,
  note,
  requireOwnership = false
}: {
  leadId: string;
  actorId: string;
  note: string;
  requireOwnership?: boolean;
}) {
  return prisma.$transaction(async (db) => {
    if (requireOwnership) {
      const ownership = await requireClaimer(db, leadId, actorId);
      if (ownership.status === "not-found") return { status: "not-found" as const };
      if (ownership.status === "forbidden") return { status: "forbidden" as const, claimedById: ownership.claimedById };
    } else {
      const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true } });
      if (!lead) return { status: "not-found" as const };
    }
    await event(db, { actorId, leadId, type: ActivityType.CALL_NOTE, note });
    return { status: "ok" as const, lead: await db.lead.findUniqueOrThrow({ where: { id: leadId }, include: leadDetailInclude }) };
  });
}

export async function updateLeadSchedule({
  leadId,
  actorId,
  kind,
  value,
  requireOwnership = false
}: {
  leadId: string;
  actorId: string;
  kind: "appointment" | "follow-up";
  value: string | null | undefined;
  requireOwnership?: boolean;
}) {
  const date = parseOptionalDate(value);
  return prisma.$transaction(async (db) => {
    if (requireOwnership) {
      const ownership = await requireClaimer(db, leadId, actorId);
      if (ownership.status === "not-found") return { status: "not-found" as const };
      if (ownership.status === "forbidden") return { status: "forbidden" as const, claimedById: ownership.claimedById };
    } else {
      const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true } });
      if (!lead) return { status: "not-found" as const };
    }
    const updated = await db.lead.update({
      where: { id: leadId },
      data: kind === "appointment" ? { appointmentDate: date } : { nextFollowUpAt: date },
      include: leadDetailInclude
    });
    await event(db, {
      actorId,
      leadId,
      type: kind === "appointment" ? ActivityType.APPOINTMENT_SET : ActivityType.FOLLOW_UP_SET,
      metadata: { value: date }
    });
    return { status: "ok" as const, lead: updated };
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
        phoneKey: pKey
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

    // Administrative field edits must not inflate call-note metrics.
    await event(db, {
      actorId,
      leadId,
      type: ActivityType.LEAD_UPDATED,
      note: "Lead details updated",
      metadata: { source: "admin-edit" }
    });

    return { status: "ok" as const, lead: updated };
  });
}

export async function bulkSetLeadClaims({
  leadIds,
  adminId,
  salesUserId
}: {
  leadIds: string[];
  adminId: string;
  salesUserId: string | null;
}) {
  const uniqueIds = [...new Set(leadIds.filter(Boolean))];
  if (!uniqueIds.length) return { updated: 0, leads: [] as Awaited<ReturnType<typeof setLeadClaim>>[] };

  const results = [];
  for (const leadId of uniqueIds) {
    const lead = await setLeadClaim({ leadId, adminId, salesUserId });
    if (lead) results.push(lead);
  }
  return { updated: results.length, leads: results };
}

export async function bulkUpdateLeadPhases({
  leadIds,
  adminId,
  phase,
  creditedUserId
}: {
  leadIds: string[];
  adminId: string;
  phase: LeadPhase;
  creditedUserId?: string | null;
}) {
  const uniqueIds = [...new Set(leadIds.filter(Boolean))];
  if (!uniqueIds.length) return { updated: 0, leads: [] as unknown[] };

  const results = [];
  for (const leadId of uniqueIds) {
    const result = await updateLeadPhase({ leadId, actorId: adminId, phase, creditedUserId, requireOwnership: false });
    if (result.status === "ok") results.push(result.lead);
  }
  return { updated: results.length, leads: results };
}

export type ImportResult = { status: "ok" | "empty"; imported: number; skipped: number; skippedRows: SkippedLeadRow[]; skippedByReason: Array<{ reason: string; count: number }> };
