import { ActivityType, ClaimRequestStatus, LeadKind, LeadPhase, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { parseOptionalDate } from "../../utils/dates.js";
import { buildLead, prepareLeadImport, readLeadRows, removeUpload, type SkippedLeadRow } from "./leadImportService.js";
import { leadDetailInclude, phoneKey } from "./leadService.js";
import {
  loadWorkflowShell,
  localLeadInclude,
  registryLeadInclude,
  rekeyPhone,
  reservePhone,
  resolveLeadRef
} from "./leadIdentity.js";
import { getLeadViewById, localLeadToView, registryLeadToView, type LeadView } from "./leadView.js";
import { phaseForPipelineStage, pipelineStageForPhaseChange, salesPipelineStages, type SalesPipelineStage } from "./pipelineStage.js";

type Db = Prisma.TransactionClient;

export type LeadInput = {
  fullName: string;
  phoneNumber: string;
  email?: string;
  appointmentDate?: string | null;
  nextFollowUpAt?: string | null;
  pipelineStage?: string;
  leadSource?: string;
  leadSourceDetail?: string;
  note?: string;
};

function leadData(input: LeadInput, actorId: string, claimActor: boolean): Prisma.LeadUncheckedCreateInput {
  const pipelineStage = input.pipelineStage && salesPipelineStages.includes(input.pipelineStage as SalesPipelineStage)
    ? input.pipelineStage as SalesPipelineStage
    : "Lead";
  return {
    fullName: input.fullName.trim(),
    phoneNumber: input.phoneNumber.trim(),
    phoneKey: phoneKey(input.phoneNumber),
    email: input.email?.trim() || "",
    phase: input.pipelineStage ? phaseForPipelineStage(pipelineStage) : undefined,
    pipelineStage,
    leadSource: input.leadSource?.trim() || null,
    leadSourceDetail: input.leadSourceDetail?.trim() || null,
    createdById: actorId,
    claimedById: claimActor ? actorId : null,
    claimedAt: claimActor ? new Date() : null,
    appointmentDate: parseOptionalDate(input.appointmentDate),
    nextFollowUpAt: parseOptionalDate(input.nextFollowUpAt)
  };
}

async function event(db: Db, input: Prisma.ActivityEventUncheckedCreateInput) {
  return db.activityEvent.create({ data: input });
}

async function findLeadByPhoneKey(phoneKeyValue: string) {
  const indexed = await prisma.leadPhoneIndex.findUnique({ where: { phoneKey: phoneKeyValue } });
  if (indexed?.kind === LeadKind.LOCAL) {
    const lead = await prisma.lead.findUnique({ where: { id: indexed.leadId }, select: { id: true, fullName: true, phoneNumber: true } });
    if (lead) return lead;
  } else if (indexed?.kind === LeadKind.REGISTRY) {
    const lead = await prisma.registryLead.findUnique({ where: { id: indexed.leadId }, select: { id: true, displayName: true, phoneNumber: true } });
    if (lead) return { id: lead.id, fullName: lead.displayName, phoneNumber: lead.phoneNumber };
  }

  const local = await prisma.lead.findUnique({ where: { phoneKey: phoneKeyValue }, select: { id: true, fullName: true, phoneNumber: true } });
  if (local) return local;
  const registry = await prisma.registryLead.findUnique({ where: { phoneKey: phoneKeyValue }, select: { id: true, displayName: true, phoneNumber: true } });
  return registry ? { id: registry.id, fullName: registry.displayName, phoneNumber: registry.phoneNumber } : null;
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
  try {
    return await prisma.$transaction(async (db) => {
    const taken = await db.leadPhoneIndex.findUnique({ where: { phoneKey: data.phoneKey } });
    if (taken) {
      const duplicate =
        taken.kind === LeadKind.LOCAL
          ? await db.lead.findUnique({
              where: { id: taken.leadId },
              select: { id: true, fullName: true, phoneNumber: true }
            })
          : await db.registryLead.findUnique({
              where: { id: taken.leadId },
              select: { id: true, displayName: true, phoneNumber: true }
            }).then((row) =>
              row
                ? { id: row.id, fullName: row.displayName, phoneNumber: row.phoneNumber }
                : null
            );
      if (duplicate) return { status: "duplicate" as const, duplicate };
    }

    const lead = await db.lead.create({ data, include: leadDetailInclude });
    await reservePhone(db, { phoneKey: data.phoneKey, kind: LeadKind.LOCAL, leadId: lead.id });
    await event(db, {
      actorId,
      leadKind: LeadKind.LOCAL,
      leadId: lead.id,
      type: ActivityType.LEAD_CREATED,
      metadata: { claimedOnCreate: claimActor, pipelineStage: input.pipelineStage || "Lead", leadSource: input.leadSource?.trim() || null, leadSourceDetail: input.leadSourceDetail?.trim() || null }
    });
    if (input.note?.trim()) {
      await event(db, { actorId, leadKind: LeadKind.LOCAL, leadId: lead.id, type: ActivityType.CALL_NOTE, note: input.note.trim() });
    }
    if (claimActor) {
      await event(db, { actorId, leadKind: LeadKind.LOCAL, leadId: lead.id, type: ActivityType.LEAD_CLAIMED });
    }
    return { status: "ok" as const, lead: localLeadToView(lead) };
    });
  } catch (error) {
    // The unique phone index remains the final arbiter when two salespeople
    // submit the same number at nearly the same time. Turn that race into the
    // same duplicate result as the preflight check so the API can warn them.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const duplicate = await findLeadByPhoneKey(data.phoneKey);
      if (duplicate) return { status: "duplicate" as const, duplicate };
    }
    throw error;
  }
}

export async function updateLeadLog({
  leadId,
  actorId,
  pipelineStage,
  note,
  requireOwnership = false
}: {
  leadId: string;
  actorId: string;
  pipelineStage: SalesPipelineStage;
  note: string;
  requireOwnership?: boolean;
}) {
  if (requireOwnership) {
    const ownership = await requireClaimer(leadId, actorId);
    if (ownership.status === "not-found") return { status: "not-found" as const };
    if (ownership.status === "forbidden") return { status: "forbidden" as const, claimedById: ownership.claimedById };
  }
  const ref = await resolveLeadRef(leadId);
  if (!ref) return { status: "not-found" as const };
  const phase = phaseForPipelineStage(pipelineStage);

  return prisma.$transaction(async (db) => {
    const current = ref.kind === LeadKind.LOCAL
      ? await db.lead.findUnique({ where: { id: ref.id }, select: { phase: true, pipelineStage: true, claimedById: true } })
      : await db.registryLead.findUnique({ where: { id: ref.id }, select: { phase: true, pipelineStage: true, claimedById: true } });
    if (!current) return { status: "not-found" as const };
    if (pipelineStage === "Closed Won" && current.phase !== LeadPhase.CLOSED_WON) {
      return { status: "closed-won-forbidden" as const };
    }

    if (ref.kind === LeadKind.LOCAL) {
      const updated = await db.lead.update({
        where: { id: ref.id },
        data: { pipelineStage, phase },
        include: localLeadInclude
      });
      await event(db, {
        actorId, leadKind: LeadKind.LOCAL, leadId: ref.id, type: ActivityType.PHASE_CHANGED,
        fromPhase: current.phase, toPhase: phase,
        metadata: { pipelineStage, fromPipelineStage: current.pipelineStage }
      });
      await event(db, { actorId, leadKind: LeadKind.LOCAL, leadId: ref.id, type: ActivityType.CALL_NOTE, note: note.trim() });
      return { status: "ok" as const, lead: localLeadToView(updated) };
    }

    const updated = await db.registryLead.update({
      where: { id: ref.id },
      data: { pipelineStage, phase },
      include: registryLeadInclude
    });
    await event(db, {
      actorId, leadKind: LeadKind.REGISTRY, leadId: ref.id, type: ActivityType.PHASE_CHANGED,
      fromPhase: current.phase, toPhase: phase,
      metadata: { pipelineStage, fromPipelineStage: current.pipelineStage }
    });
    await event(db, { actorId, leadKind: LeadKind.REGISTRY, leadId: ref.id, type: ActivityType.CALL_NOTE, note: note.trim() });
    return { status: "ok" as const, lead: registryLeadToView(updated) };
  });
}

export async function importLeads({
  file,
  actorId,
  claimActor = false,
  source
}: {
  file: Express.Multer.File;
  actorId: string;
  claimActor?: boolean;
  source: "admin-upload" | "sales-upload";
}) {
  try {
    const rows = await readLeadRows(file);
    const candidates = rows.map((row, index) => ({ rowNumber: index + 2, lead: buildLead(row, { createdById: actorId }) }));
    return await prisma.$transaction(async (db) => {
      const { leads, skipped } = await prepareLeadImport(db, candidates);
      let skippedByReason = summarizeSkippedRows(skipped);
      if (!leads.length) {
        return { status: "empty" as const, imported: 0, skipped: skipped.length, skippedRows: skipped.slice(0, 25), skippedByReason };
      }
      const now = new Date();
      const inserted = await db.lead.createMany({
        data: leads.map((lead) => ({
          ...lead,
          claimedById: claimActor ? actorId : null,
          claimedAt: claimActor ? now : null
        })),
        skipDuplicates: true
      });
      const writeConflicts = leads.length - inserted.count;
      if (writeConflicts) {
        skipped.push(...Array.from({ length: writeConflicts }, () => ({ row: 0, reason: "Already exists in CRM" })));
      }
      skippedByReason = summarizeSkippedRows(skipped);
      if (!inserted.count) {
        return { status: "empty" as const, imported: 0, skipped: skipped.length, skippedRows: skipped.slice(0, 25), skippedByReason };
      }

      const created = await db.lead.findMany({
        where: { phoneKey: { in: leads.map((l) => l.phoneKey) } },
        select: { id: true, phoneKey: true }
      });
      if (created.length) {
        await db.leadPhoneIndex.createMany({
          data: created.map((row) => ({ phoneKey: row.phoneKey, kind: LeadKind.LOCAL, leadId: row.id })),
          skipDuplicates: true
        });
      }

      await event(db, {
        actorId,
        type: ActivityType.LEAD_IMPORTED,
        metadata: { source, imported: inserted.count, skipped: skipped.length }
      });
      return {
        status: "ok" as const,
        imported: inserted.count,
        skipped: skipped.length,
        skippedRows: skipped.slice(0, 25),
        skippedByReason
      };
    });
  } finally {
    await removeUpload(file);
  }
}

export async function claimLead({ leadId, actorId }: { leadId: string; actorId: string }) {
  const ref = await resolveLeadRef(leadId);
  if (!ref) return { status: "not-found" as const };

  return prisma.$transaction(async (db) => {
    if (ref.kind === LeadKind.LOCAL) {
      const claimed = await db.lead.updateMany({
        where: { id: ref.id, claimedById: null },
        data: { claimedById: actorId, claimedAt: new Date() }
      });
      if (claimed.count === 0) {
        const lead = await db.lead.findUnique({ where: { id: ref.id }, select: { id: true, claimedById: true } });
        return lead ? { status: "already-claimed" as const, claimedById: lead.claimedById } : { status: "not-found" as const };
      }
      await event(db, { actorId, leadKind: LeadKind.LOCAL, leadId: ref.id, type: ActivityType.LEAD_CLAIMED });
      const lead = await db.lead.findUniqueOrThrow({ where: { id: ref.id }, include: localLeadInclude });
      return { status: "ok" as const, lead: localLeadToView(lead) };
    }

    const claimed = await db.registryLead.updateMany({
      where: { id: ref.id, claimedById: null },
      data: { claimedById: actorId, claimedAt: new Date() }
    });
    if (claimed.count === 0) {
      const lead = await db.registryLead.findUnique({ where: { id: ref.id }, select: { id: true, claimedById: true } });
      return lead ? { status: "already-claimed" as const, claimedById: lead.claimedById } : { status: "not-found" as const };
    }
    await event(db, { actorId, leadKind: LeadKind.REGISTRY, leadId: ref.id, type: ActivityType.LEAD_CLAIMED });
    const lead = await db.registryLead.findUniqueOrThrow({ where: { id: ref.id }, include: registryLeadInclude });
    return { status: "ok" as const, lead: registryLeadToView(lead) };
  });
}

export async function requestClaimTransfer({ leadId, actorId, reason }: { leadId: string; actorId: string; reason: string }) {
  const shell = await loadWorkflowShell(leadId);
  if (!shell) return { status: "not-found" as const };
  if (!shell.claimedById) return { status: "unclaimed" as const };
  if (shell.claimedById === actorId) return { status: "already-claimer" as const };

  return prisma.$transaction(async (db) => {
    const pending = await db.claimTransferRequest.findFirst({
      where: { leadKind: shell.kind, leadId: shell.id, status: ClaimRequestStatus.PENDING },
      select: { id: true }
    });
    if (pending) return { status: "pending-exists" as const, requestId: pending.id };

    try {
      const request = await db.claimTransferRequest.create({
        data: { leadKind: shell.kind, leadId: shell.id, requestedById: actorId, reason }
      });
      await event(db, {
        actorId,
        leadKind: shell.kind,
        leadId: shell.id,
        type: ActivityType.CLAIM_TRANSFER_REQUESTED,
        metadata: { requestId: request.id, currentClaimerId: shell.claimedById }
      });
      return { status: "ok" as const, request };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { status: "pending-exists" as const };
      }
      throw error;
    }
  });
}

export async function resolveClaimTransfer({
  requestId,
  adminId,
  approve
}: {
  requestId: string;
  adminId: string;
  approve: boolean;
}) {
  return prisma.$transaction(async (db) => {
    const request = await db.claimTransferRequest.findUnique({ where: { id: requestId } });
    if (!request || request.status !== ClaimRequestStatus.PENDING) return null;
    const status = approve ? ClaimRequestStatus.APPROVED : ClaimRequestStatus.REJECTED;
    await db.claimTransferRequest.update({
      where: { id: requestId },
      data: { status, resolvedById: adminId, resolvedAt: new Date() }
    });
    if (approve) {
      if (request.leadKind === LeadKind.LOCAL) {
        await db.lead.update({
          where: { id: request.leadId },
          data: { claimedById: request.requestedById, claimedAt: new Date() }
        });
      } else {
        await db.registryLead.update({
          where: { id: request.leadId },
          data: { claimedById: request.requestedById, claimedAt: new Date() }
        });
      }
    }
    await event(db, {
      actorId: adminId,
      leadKind: request.leadKind,
      leadId: request.leadId,
      type: approve ? ActivityType.CLAIM_TRANSFER_APPROVED : ActivityType.CLAIM_TRANSFER_REJECTED,
      metadata: { requestId, requestedById: request.requestedById }
    });
    return getLeadViewById(request.leadId);
  });
}

export async function setLeadClaim({
  leadId,
  adminId,
  salesUserId
}: {
  leadId: string;
  adminId: string;
  salesUserId: string | null;
}) {
  const ref = await resolveLeadRef(leadId);
  if (!ref) return null;

  return prisma.$transaction(async (db) => {
    if (ref.kind === LeadKind.LOCAL) {
      const updated = await db.lead.update({
        where: { id: ref.id },
        data: { claimedById: salesUserId, claimedAt: salesUserId ? new Date() : null },
        include: localLeadInclude
      });
      await event(db, {
        actorId: adminId,
        leadKind: LeadKind.LOCAL,
        leadId: ref.id,
        type: ActivityType.LEAD_CLAIMED,
        metadata: { claimedById: salesUserId, source: "admin" }
      });
      return localLeadToView(updated);
    }
    const updated = await db.registryLead.update({
      where: { id: ref.id },
      data: { claimedById: salesUserId, claimedAt: salesUserId ? new Date() : null },
      include: registryLeadInclude
    });
    await event(db, {
      actorId: adminId,
      leadKind: LeadKind.REGISTRY,
      leadId: ref.id,
      type: ActivityType.LEAD_CLAIMED,
      metadata: { claimedById: salesUserId, source: "admin" }
    });
    return registryLeadToView(updated);
  });
}

async function requireClaimer(leadId: string, actorId: string) {
  const shell = await loadWorkflowShell(leadId);
  if (!shell) return { status: "not-found" as const };
  if (shell.claimedById !== actorId) return { status: "forbidden" as const, claimedById: shell.claimedById };
  return { status: "ok" as const, shell };
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
  requireOwnership?: boolean;
}) {
  if (requireOwnership) {
    const ownership = await requireClaimer(leadId, actorId);
    if (ownership.status === "not-found") return { status: "not-found" as const };
    if (ownership.status === "forbidden") return { status: "forbidden" as const, claimedById: ownership.claimedById };
  }

  const ref = await resolveLeadRef(leadId);
  if (!ref) return { status: "not-found" as const };

  return prisma.$transaction(async (db) => {
    if (ref.kind === LeadKind.LOCAL) {
      const existing = await db.lead.findUnique({ where: { id: ref.id } });
      if (!existing) return { status: "not-found" as const };
      const updated = await db.lead.update({ where: { id: ref.id }, data: { phase, pipelineStage: pipelineStageForPhaseChange(phase, existing.pipelineStage) }, include: localLeadInclude });
      await event(db, {
        actorId,
        leadKind: LeadKind.LOCAL,
        leadId: ref.id,
        type: ActivityType.PHASE_CHANGED,
        fromPhase: existing.phase,
        toPhase: phase,
        metadata: { pipelineStage: updated.pipelineStage, fromPipelineStage: existing.pipelineStage },
        creditedUserId: phase === LeadPhase.CLOSED_WON
          ? creditedUserId || actorId
          : phase === LeadPhase.CLOSED_LOST
            ? existing.claimedById || actorId
            : null
      });
      return { status: "ok" as const, lead: localLeadToView(updated) };
    }

    const existing = await db.registryLead.findUnique({ where: { id: ref.id } });
    if (!existing) return { status: "not-found" as const };
    const updated = await db.registryLead.update({
      where: { id: ref.id },
      data: { phase, pipelineStage: pipelineStageForPhaseChange(phase, existing.pipelineStage) },
      include: registryLeadInclude
    });
    await event(db, {
      actorId,
      leadKind: LeadKind.REGISTRY,
      leadId: ref.id,
      type: ActivityType.PHASE_CHANGED,
      fromPhase: existing.phase,
      toPhase: phase,
      metadata: { pipelineStage: updated.pipelineStage, fromPipelineStage: existing.pipelineStage },
      creditedUserId: phase === LeadPhase.CLOSED_WON
        ? creditedUserId || actorId
        : phase === LeadPhase.CLOSED_LOST
          ? existing.claimedById || actorId
          : null
    });
    return { status: "ok" as const, lead: registryLeadToView(updated) };
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
  if (requireOwnership) {
    const ownership = await requireClaimer(leadId, actorId);
    if (ownership.status === "not-found") return { status: "not-found" as const };
    if (ownership.status === "forbidden") return { status: "forbidden" as const, claimedById: ownership.claimedById };
  }
  const ref = await resolveLeadRef(leadId);
  if (!ref) return { status: "not-found" as const };

  return prisma.$transaction(async (db) => {
    await event(db, { actorId, leadKind: ref.kind, leadId: ref.id, type: ActivityType.CALL_NOTE, note });
    const view = await getLeadViewById(ref.id);
    if (!view) return { status: "not-found" as const };
    return { status: "ok" as const, lead: view };
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
  if (requireOwnership) {
    const ownership = await requireClaimer(leadId, actorId);
    if (ownership.status === "not-found") return { status: "not-found" as const };
    if (ownership.status === "forbidden") return { status: "forbidden" as const, claimedById: ownership.claimedById };
  }
  const ref = await resolveLeadRef(leadId);
  if (!ref) return { status: "not-found" as const };
  const date = parseOptionalDate(value);

  return prisma.$transaction(async (db) => {
    if (ref.kind === LeadKind.LOCAL) {
      const updated = await db.lead.update({
        where: { id: ref.id },
        data: kind === "appointment" ? { appointmentDate: date } : { nextFollowUpAt: date },
        include: localLeadInclude
      });
      await event(db, {
        actorId,
        leadKind: LeadKind.LOCAL,
        leadId: ref.id,
        type: kind === "appointment" ? ActivityType.APPOINTMENT_SET : ActivityType.FOLLOW_UP_SET,
        metadata: { value: date }
      });
      return { status: "ok" as const, lead: localLeadToView(updated) };
    }
    const updated = await db.registryLead.update({
      where: { id: ref.id },
      data: kind === "appointment" ? { appointmentDate: date } : { nextFollowUpAt: date },
      include: registryLeadInclude
    });
    await event(db, {
      actorId,
      leadKind: LeadKind.REGISTRY,
      leadId: ref.id,
      type: kind === "appointment" ? ActivityType.APPOINTMENT_SET : ActivityType.FOLLOW_UP_SET,
      metadata: { value: date }
    });
    return { status: "ok" as const, lead: registryLeadToView(updated) };
  });
}

export async function updateLead({ leadId, input, actorId, requireOwnership = false }: { leadId: string; input: LeadInput; actorId: string; requireOwnership?: boolean }) {
  const ref = await resolveLeadRef(leadId);
  if (!ref) return { status: "not-found" as const };
  if (requireOwnership) {
    const ownership = await requireClaimer(leadId, actorId);
    if (ownership.status === "not-found") return { status: "not-found" as const };
    if (ownership.status === "forbidden") return { status: "forbidden" as const, claimedById: ownership.claimedById };
  }
  if (ref.kind === LeadKind.REGISTRY) {
    return { status: "invalid" as const, message: "Registry leads are directory-backed and cannot be edited here" };
  }

  const pKey = phoneKey(input.phoneNumber);

  return prisma.$transaction(async (db) => {
    const existing = await db.lead.findUnique({ where: { id: ref.id } });
    if (!existing) return { status: "not-found" as const };

    const preserveMinutePrecision = (value: string | null | undefined, previous: Date | null) => {
      if (value === undefined) return previous;
      const parsed = parseOptionalDate(value);
      if (parsed && previous && Math.floor(parsed.getTime() / 60_000) === Math.floor(previous.getTime() / 60_000)) return previous;
      return parsed;
    };
    const appointmentDate = preserveMinutePrecision(input.appointmentDate, existing.appointmentDate);
    const nextFollowUpAt = preserveMinutePrecision(input.nextFollowUpAt, existing.nextFollowUpAt);
    const values = {
      fullName: input.fullName.trim(),
      phoneNumber: input.phoneNumber.trim(),
      email: input.email?.trim() || "",
      leadSource: input.leadSource?.trim() || null,
      leadSourceDetail: input.leadSourceDetail?.trim() || null,
      appointmentDate,
      nextFollowUpAt
    };
    const priorValues = {
      fullName: existing.fullName,
      phoneNumber: existing.phoneNumber,
      email: existing.email,
      leadSource: existing.leadSource,
      leadSourceDetail: existing.leadSourceDetail,
      appointmentDate: existing.appointmentDate,
      nextFollowUpAt: existing.nextFollowUpAt
    };
    const changes = Object.fromEntries(
      Object.entries(values)
        .filter(([key, value]) => {
          const previous = priorValues[key as keyof typeof priorValues];
          const normalize = (item: unknown) => item instanceof Date ? item.toISOString() : item;
          return normalize(value) !== normalize(previous);
        })
        .map(([key, value]) => {
          const previous = priorValues[key as keyof typeof priorValues];
          const serialize = (item: unknown) => item instanceof Date ? item.toISOString() : item;
          return [key, { from: serialize(previous), to: serialize(value) }];
        })
    );

    if (pKey !== existing.phoneKey) {
      const taken = await db.leadPhoneIndex.findUnique({ where: { phoneKey: pKey } });
      if (taken && taken.leadId !== ref.id) {
        return {
          status: "duplicate" as const,
          duplicate: { id: taken.leadId, fullName: "", phoneNumber: input.phoneNumber }
        };
      }
    }

    const updated = await db.lead.update({
      where: { id: ref.id },
      data: {
        ...values,
        phoneKey: pKey,
      },
      include: localLeadInclude
    });

    if (pKey !== existing.phoneKey) {
      await rekeyPhone(db, {
        oldPhoneKey: existing.phoneKey,
        newPhoneKey: pKey,
        kind: LeadKind.LOCAL,
        leadId: ref.id
      });
    }

    if (Object.keys(changes).length) {
      await event(db, {
        actorId,
        leadKind: LeadKind.LOCAL,
        leadId: ref.id,
        type: ActivityType.LEAD_UPDATED,
        note: "Lead details edited",
        metadata: { source: requireOwnership ? "sales-edit" : "admin-edit", changes: changes as Prisma.InputJsonObject }
      });
    }

    return { status: "ok" as const, lead: localLeadToView(updated) };
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
  if (!uniqueIds.length) return { updated: 0, leads: [] as LeadView[] };

  const results: LeadView[] = [];
  for (const id of uniqueIds) {
    const lead = await setLeadClaim({ leadId: id, adminId, salesUserId });
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
  if (!uniqueIds.length) return { updated: 0, leads: [] as LeadView[] };

  const results: LeadView[] = [];
  for (const id of uniqueIds) {
    const result = await updateLeadPhase({
      leadId: id,
      actorId: adminId,
      phase,
      creditedUserId,
      requireOwnership: false
    });
    if (result.status === "ok") results.push(result.lead);
  }
  return { updated: results.length, leads: results };
}

export type ImportResult = {
  status: "ok" | "empty";
  imported: number;
  skipped: number;
  skippedRows: SkippedLeadRow[];
  skippedByReason: Array<{ reason: string; count: number }>;
};
