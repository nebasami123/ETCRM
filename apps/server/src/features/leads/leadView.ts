import { LeadKind, LeadPhase, type Lead, type RegistryLead } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { buildVirtualLeadId, localLeadInclude, registryLeadInclude, type LeadRef } from "./leadIdentity.js";
import { pipelineStageForPhase } from "./pipelineStage.js";
import type { DirectoryRow } from "../registry/registryTypes.js";

type UserBits = { id: string; name: string; email?: string | null; role?: string | null } | null;

export type LeadView = {
  id: string;
  fullName: string;
  phoneNumber: string;
  phoneKey?: string;
  email?: string | null;
  phase: LeadPhase;
  pipelineStage: string;
  leadSource?: string | null;
  leadSourceDetail?: string | null;
  /** LOCAL | MONGO — MONGO means registry shell (client-compatible). */
  source: "LOCAL" | "MONGO";
  kind: LeadKind | "VIRTUAL";
  mongoBusinessId?: string | null;
  externalBusinessId?: string | null;
  isVirtual?: boolean;
  claimedBy?: UserBits;
  createdBy?: UserBits;
  claimedById?: string | null;
  claimedAt?: Date | null;
  createdById?: string | null;
  appointmentDate?: Date | null;
  nextFollowUpAt?: Date | null;
  registryHydrated?: boolean;
  events?: unknown[];
  contactMasked?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export function localLeadToView(
  lead: Lead & { createdBy?: UserBits; claimedBy?: UserBits; events?: unknown[] }
): LeadView {
  return {
    id: lead.id,
    fullName: lead.fullName,
    phoneNumber: lead.phoneNumber,
    phoneKey: lead.phoneKey,
    email: lead.email,
    phase: lead.phase,
    pipelineStage: lead.pipelineStage ?? pipelineStageForPhase(lead.phase),
    leadSource: lead.leadSource,
    leadSourceDetail: lead.leadSourceDetail,
    source: "LOCAL",
    kind: LeadKind.LOCAL,
    mongoBusinessId: null,
    externalBusinessId: null,
    isVirtual: false,
    claimedBy: lead.claimedBy ?? null,
    createdBy: lead.createdBy ?? null,
    claimedById: lead.claimedById,
    claimedAt: lead.claimedAt,
    createdById: lead.createdById,
    appointmentDate: lead.appointmentDate,
    nextFollowUpAt: lead.nextFollowUpAt,
    events: lead.events,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt
  };
}

export function registryLeadToView(
  lead: RegistryLead & { createdBy?: UserBits; claimedBy?: UserBits; events?: unknown[] },
  overlay?: Partial<LeadView>
): LeadView {
  return {
    id: lead.id,
    fullName: overlay?.fullName ?? lead.displayName,
    phoneNumber: overlay?.phoneNumber ?? lead.phoneNumber,
    phoneKey: lead.phoneKey,
    email: overlay?.email ?? "",
    phase: lead.phase,
    pipelineStage: lead.pipelineStage ?? pipelineStageForPhase(lead.phase),
    leadSource: lead.leadSource,
    leadSourceDetail: lead.leadSourceDetail,
    source: "MONGO",
    kind: LeadKind.REGISTRY,
    mongoBusinessId: lead.externalBusinessId,
    externalBusinessId: lead.externalBusinessId,
    isVirtual: false,
    claimedBy: lead.claimedBy ?? null,
    createdBy: lead.createdBy ?? null,
    claimedById: lead.claimedById,
    claimedAt: lead.claimedAt,
    createdById: lead.createdById,
    appointmentDate: lead.appointmentDate,
    nextFollowUpAt: lead.nextFollowUpAt,
    registryHydrated: overlay?.registryHydrated ?? false,
    events: lead.events,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt
  };
}

export function directoryRowToVirtualView(row: DirectoryRow): LeadView {
  return {
    id: buildVirtualLeadId(row.mongoBusinessId ?? row.externalBusinessId ?? "", row.phoneKey),
    fullName: row.fullName,
    phoneNumber: row.phoneNumber,
    phoneKey: row.phoneKey,
    email: "",
    phase: LeadPhase.NEW,
    pipelineStage: "Lead",
    leadSource: null,
    leadSourceDetail: null,
    source: "MONGO",
    kind: "VIRTUAL",
    mongoBusinessId: row.mongoBusinessId ?? row.externalBusinessId,
    externalBusinessId: row.mongoBusinessId ?? row.externalBusinessId,
    isVirtual: true,
    claimedBy: null,
    createdBy: null,
    claimedById: null,
    claimedAt: null,
    createdById: null,
    appointmentDate: null,
    nextFollowUpAt: null,
    events: [],
    registryHydrated: true,
    createdAt: new Date(0),
    updatedAt: new Date(0)
  };
}

export async function loadLeadEvents(ref: LeadRef) {
  return prisma.activityEvent.findMany({
    where: { leadKind: ref.kind, leadId: ref.id },
    include: {
      actor: { select: { id: true, name: true, role: true } },
      creditedUser: { select: { id: true, name: true, role: true } }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getLeadViewById(leadId: string): Promise<LeadView | null> {
  const local = await prisma.lead.findUnique({ where: { id: leadId }, include: localLeadInclude });
  if (local) {
    const events = await loadLeadEvents({ kind: LeadKind.LOCAL, id: local.id });
    return localLeadToView({ ...local, events });
  }
  const registry = await prisma.registryLead.findUnique({ where: { id: leadId }, include: registryLeadInclude });
  if (registry) {
    const events = await loadLeadEvents({ kind: LeadKind.REGISTRY, id: registry.id });
    return registryLeadToView({ ...registry, events });
  }
  return null;
}
