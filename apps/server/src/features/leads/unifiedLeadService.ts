import { LeadKind, LeadPhase } from "@prisma/client";
import { prisma } from "../../config/db.js";
import {
  claimRegistryLead,
  getMongoBusinessById,
  hydrateMongoLeads,
  listRegistryLeads,
  flattenBusinessToRegistryLeads
} from "../registry/registryService.js";
import type { RegistryFilters } from "../registry/registryTypes.js";
import {
  buildVirtualLeadId,
  isVirtualLeadId,
  parseVirtualLeadId,
  registryLeadInclude,
  resolveLeadRef
} from "./leadIdentity.js";
import {
  directoryRowToVirtualView,
  getLeadViewById,
  localLeadToView,
  registryLeadToView,
  type LeadView
} from "./leadView.js";
import { localLeadInclude } from "./leadIdentity.js";

export { isVirtualLeadId, buildVirtualLeadId, parseVirtualLeadId };

export function shouldUseLiveMongoList(filters: {
  scope?: string;
  phase?: string;
  source?: string;
  claimedById?: string;
}) {
  if (filters.scope === "mine") return false;
  const source = filters.source?.trim().toUpperCase();
  if (source === "LOCAL") return false;
  const phase = filters.phase?.trim().toUpperCase();
  if (phase && phase !== "ALL" && phase !== "NEW") return false;
  const claimedById = filters.claimedById?.trim();
  if (claimedById && claimedById !== "UNCLAIMED") return false;
  return true;
}

export async function listLiveMongoLeads(filters: RegistryFilters & { claimedById?: string }) {
  const result = await listRegistryLeads(filters);
  const phoneKeys = result.leads.map((row) => row.phoneKey);
  const indexRows = phoneKeys.length
    ? await prisma.leadPhoneIndex.findMany({ where: { phoneKey: { in: phoneKeys } } })
    : [];
  const localIds = indexRows.filter((r) => r.kind === LeadKind.LOCAL).map((r) => r.leadId);
  const regIds = indexRows.filter((r) => r.kind === LeadKind.REGISTRY).map((r) => r.leadId);
  const [locals, regs] = await Promise.all([
    localIds.length
      ? prisma.lead.findMany({ where: { id: { in: localIds } }, include: localLeadInclude })
      : [],
    regIds.length
      ? prisma.registryLead.findMany({ where: { id: { in: regIds } }, include: registryLeadInclude })
      : []
  ]);
  const byPhone = new Map<string, LeadView>();
  for (const lead of locals) byPhone.set(lead.phoneKey, localLeadToView(lead));
  for (const lead of regs) byPhone.set(lead.phoneKey, registryLeadToView(lead));

  let leads = await Promise.all(
    result.leads.map(async (row) => {
      const crm = byPhone.get(row.phoneKey);
      if (crm) {
        const [hydrated] = await hydrateMongoLeads([crm]);
        return { ...(hydrated || crm), isVirtual: false };
      }
      return directoryRowToVirtualView(row);
    })
  );

  const claimedById = filters.claimedById?.trim();
  if (claimedById === "UNCLAIMED") {
    leads = leads.filter((lead) => !lead.claimedById);
  }

  const phase = filters.phase?.trim().toUpperCase();
  if (phase === "NEW") {
    leads = leads.filter((lead) => lead.phase === LeadPhase.NEW);
  }

  return {
    leads,
    pagination: result.pagination
  };
}

export async function getVirtualOrPersistedLead(leadId: string) {
  if (!isVirtualLeadId(leadId)) {
    const view = await getLeadViewById(leadId);
    if (!view) return null;
    if (view.source === "MONGO") {
      const [hydrated] = await hydrateMongoLeads([view]);
      return hydrated || view;
    }
    return view;
  }

  const parsed = parseVirtualLeadId(leadId);
  if (!parsed) return null;

  const indexed = await prisma.leadPhoneIndex.findUnique({ where: { phoneKey: parsed.phoneKey } });
  if (indexed) {
    const view = await getLeadViewById(indexed.leadId);
    if (view) {
      if (view.source === "MONGO") {
        const [hydrated] = await hydrateMongoLeads([view]);
        return hydrated || view;
      }
      return view;
    }
  }

  const business = await getMongoBusinessById(parsed.externalBusinessId);
  if (!business) return null;
  const match = flattenBusinessToRegistryLeads(business).find((row) => row.phoneKey === parsed.phoneKey);
  if (!match) return null;
  return directoryRowToVirtualView({
    ...match,
    externalBusinessId: match.mongoBusinessId,
    crmLeadId: null,
    crmPhase: null,
    claimedById: null,
    claimedByName: null,
    inCrm: false
  });
}

export async function claimVirtualOrPersistedLead(input: { leadId: string; actorId: string }) {
  if (isVirtualLeadId(input.leadId)) {
    const parsed = parseVirtualLeadId(input.leadId);
    if (!parsed) return { status: "not-found" as const };
    const indexed = await prisma.leadPhoneIndex.findUnique({ where: { phoneKey: parsed.phoneKey } });
    if (indexed) {
      if (indexed.kind === LeadKind.REGISTRY) {
        const existing = await prisma.registryLead.findUnique({
          where: { id: indexed.leadId },
          select: { id: true, claimedById: true }
        });
        if (existing?.claimedById) {
          return { status: "already-claimed" as const, claimedById: existing.claimedById };
        }
        if (existing && !existing.claimedById) {
          const { claimLead } = await import("./leadWorkflowService.js");
          return claimLead({ leadId: existing.id, actorId: input.actorId });
        }
      } else {
        const existing = await prisma.lead.findUnique({
          where: { id: indexed.leadId },
          select: { id: true, claimedById: true }
        });
        if (existing?.claimedById) {
          return { status: "already-claimed" as const, claimedById: existing.claimedById };
        }
        if (existing && !existing.claimedById) {
          const { claimLead } = await import("./leadWorkflowService.js");
          return claimLead({ leadId: existing.id, actorId: input.actorId });
        }
      }
    }

    const created = await claimRegistryLead({
      mongoBusinessId: parsed.externalBusinessId,
      phoneKey: parsed.phoneKey,
      actorId: input.actorId,
      claimActor: true
    });
    if (created.status === "duplicate" && created.duplicate) {
      if (created.duplicate.claimedById) {
        return { status: "already-claimed" as const, claimedById: created.duplicate.claimedById };
      }
      const { claimLead } = await import("./leadWorkflowService.js");
      return claimLead({ leadId: created.duplicate.id, actorId: input.actorId });
    }
    if (created.status === "ok") return { status: "ok" as const, lead: created.lead };
    return { status: "not-found" as const };
  }

  const ref = await resolveLeadRef(input.leadId);
  if (!ref) return { status: "not-found" as const };
  const { claimLead } = await import("./leadWorkflowService.js");
  return claimLead({ leadId: ref.id, actorId: input.actorId });
}
