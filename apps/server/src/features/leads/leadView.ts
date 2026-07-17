import { LeadKind, LeadPhase, type Lead, type RegistryLead } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { buildVirtualLeadId, localLeadInclude, registryLeadInclude, type LeadRef } from "./leadIdentity.js";
import type { DirectoryRow } from "../registry/registryTypes.js";

type UserBits = { id: string; name: string; email?: string | null; role?: string | null } | null;

export type LeadView = {
  id: string;
  fullName: string;
  phoneNumber: string;
  phoneKey?: string;
  email?: string | null;
  phase: LeadPhase;
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
  dateRegistered?: Date | null;
  renewedTo?: Date | null;
  businessName?: string | null;
  businessNameAmharic?: string | null;
  legalStatusNameEng?: string | null;
  legalStatusNameAmh?: string | null;
  licenceNumber?: string | null;
  businessRegion?: string | null;
  businessZone?: string | null;
  businessWoreda?: string | null;
  businessKebele?: string | null;
  houseNumber?: string | null;
  businessTelephone?: string | null;
  managerFName?: string | null;
  managerMName?: string | null;
  managerLName?: string | null;
  englishDescription?: string | null;
  code?: string | null;
  subGroupEn?: string | null;
  registryHydrated?: boolean;
  registry?: {
    capital?: number;
    value?: number;
    nationality?: string;
    tin?: string;
  };
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
    dateRegistered: lead.dateRegistered,
    renewedTo: lead.renewedTo,
    businessName: lead.businessName,
    businessNameAmharic: lead.businessNameAmharic,
    legalStatusNameEng: lead.legalStatusNameEng,
    legalStatusNameAmh: lead.legalStatusNameAmh,
    licenceNumber: lead.licenceNumber,
    businessRegion: lead.businessRegion,
    businessZone: lead.businessZone,
    businessWoreda: lead.businessWoreda,
    businessKebele: lead.businessKebele,
    houseNumber: lead.houseNumber,
    businessTelephone: lead.businessTelephone,
    managerFName: lead.managerFName,
    managerMName: lead.managerMName,
    managerLName: lead.managerLName,
    englishDescription: lead.englishDescription,
    code: lead.code,
    subGroupEn: lead.subGroupEn,
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
    businessName: overlay?.businessName ?? null,
    licenceNumber: overlay?.licenceNumber ?? null,
    legalStatusNameEng: overlay?.legalStatusNameEng ?? null,
    managerFName: overlay?.managerFName ?? null,
    managerLName: overlay?.managerLName ?? null,
    englishDescription: overlay?.englishDescription ?? lead.sectorKey ?? null,
    code: overlay?.code ?? null,
    businessRegion: overlay?.businessRegion ?? lead.regionKey ?? null,
    businessWoreda: overlay?.businessWoreda ?? lead.subcityKey ?? null,
    businessTelephone: overlay?.businessTelephone ?? null,
    registryHydrated: overlay?.registryHydrated ?? false,
    registry: overlay?.registry,
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
    dateRegistered: row.dateRegistered ? new Date(row.dateRegistered) : null,
    businessName: row.businessName || null,
    licenceNumber: row.tin || null,
    legalStatusNameEng: row.businessType || null,
    managerFName: row.managerFirstName || null,
    managerLName: row.managerLastName || null,
    code: row.sector || null,
    englishDescription: row.sectorCategory || null,
    businessRegion: row.region || null,
    businessWoreda: row.subcity || null,
    businessTelephone: row.businessNumber || null,
    events: [],
    registryHydrated: true,
    registry: {
      capital: row.capital,
      value: row.value,
      nationality: row.nationality,
      tin: row.tin
    },
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
