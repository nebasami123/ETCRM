import { LeadKind, type LeadPhase, type Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";

export { LeadKind };

export type LeadRef = { kind: LeadKind; id: string };

export const userSelect = { id: true, name: true, email: true, role: true } as const;

export const localLeadInclude = {
  createdBy: { select: userSelect },
  claimedBy: { select: userSelect }
} satisfies Prisma.LeadInclude;

export const registryLeadInclude = {
  createdBy: { select: userSelect },
  claimedBy: { select: userSelect }
} satisfies Prisma.RegistryLeadInclude;

const VIRTUAL_PREFIX = "m_";

export function isVirtualLeadId(id: string) {
  return id.startsWith(VIRTUAL_PREFIX) || id.startsWith("virt:");
}

export function buildVirtualLeadId(externalBusinessId: string, phoneKey: string) {
  return `${VIRTUAL_PREFIX}${externalBusinessId}_${phoneKey}`;
}

export function parseVirtualLeadId(id: string): { externalBusinessId: string; phoneKey: string } | null {
  if (id.startsWith("virt:")) {
    const raw = id.slice("virt:".length);
    const splitAt = raw.lastIndexOf(":");
    if (splitAt <= 0) return null;
    const externalBusinessId = raw.slice(0, splitAt);
    const phoneKey = raw.slice(splitAt + 1);
    return externalBusinessId && phoneKey ? { externalBusinessId, phoneKey } : null;
  }
  if (!id.startsWith(VIRTUAL_PREFIX)) return null;
  const raw = id.slice(VIRTUAL_PREFIX.length);
  const splitAt = raw.lastIndexOf("_");
  if (splitAt <= 0) return null;
  const externalBusinessId = raw.slice(0, splitAt);
  const phoneKey = raw.slice(splitAt + 1);
  return externalBusinessId && phoneKey ? { externalBusinessId, phoneKey } : null;
}

export async function resolveLeadRef(leadId: string): Promise<LeadRef | null> {
  if (!leadId || isVirtualLeadId(leadId)) return null;
  const indexed = await prisma.leadPhoneIndex.findFirst({
    where: { leadId },
    select: { kind: true, leadId: true }
  });
  if (indexed) return { kind: indexed.kind, id: indexed.leadId };

  const local = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (local) return { kind: LeadKind.LOCAL, id: local.id };

  const registry = await prisma.registryLead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (registry) return { kind: LeadKind.REGISTRY, id: registry.id };

  return null;
}

export async function findPhoneOwner(phoneKey: string) {
  return prisma.leadPhoneIndex.findUnique({ where: { phoneKey } });
}

export async function reservePhone(
  db: Prisma.TransactionClient,
  input: { phoneKey: string; kind: LeadKind; leadId: string }
) {
  return db.leadPhoneIndex.create({
    data: { phoneKey: input.phoneKey, kind: input.kind, leadId: input.leadId }
  });
}

export async function releasePhone(db: Prisma.TransactionClient, phoneKey: string) {
  await db.leadPhoneIndex.deleteMany({ where: { phoneKey } });
}

export async function rekeyPhone(
  db: Prisma.TransactionClient,
  input: { oldPhoneKey: string; newPhoneKey: string; kind: LeadKind; leadId: string }
) {
  if (input.oldPhoneKey === input.newPhoneKey) return;
  await db.leadPhoneIndex.deleteMany({ where: { phoneKey: input.oldPhoneKey } });
  await db.leadPhoneIndex.create({
    data: { phoneKey: input.newPhoneKey, kind: input.kind, leadId: input.leadId }
  });
}

export type WorkflowShell = {
  id: string;
  kind: LeadKind;
  phase: LeadPhase;
  claimedById: string | null;
  phoneKey: string;
  phoneNumber: string;
  displayName: string;
};

export async function loadWorkflowShell(leadId: string): Promise<WorkflowShell | null> {
  const ref = await resolveLeadRef(leadId);
  if (!ref) return null;
  if (ref.kind === LeadKind.LOCAL) {
    const lead = await prisma.lead.findUnique({
      where: { id: ref.id },
      select: { id: true, phase: true, claimedById: true, phoneKey: true, phoneNumber: true, fullName: true }
    });
    if (!lead) return null;
    return {
      id: lead.id,
      kind: LeadKind.LOCAL,
      phase: lead.phase,
      claimedById: lead.claimedById,
      phoneKey: lead.phoneKey,
      phoneNumber: lead.phoneNumber,
      displayName: lead.fullName
    };
  }
  const lead = await prisma.registryLead.findUnique({
    where: { id: ref.id },
    select: { id: true, phase: true, claimedById: true, phoneKey: true, phoneNumber: true, displayName: true }
  });
  if (!lead) return null;
  return {
    id: lead.id,
    kind: LeadKind.REGISTRY,
    phase: lead.phase,
    claimedById: lead.claimedById,
    phoneKey: lead.phoneKey,
    phoneNumber: lead.phoneNumber,
    displayName: lead.displayName
  };
}
