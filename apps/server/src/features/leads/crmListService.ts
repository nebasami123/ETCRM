import { LeadKind, LeadPhase, type Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { normalizeSectorFilter } from "../registry/registryService.js";
import { hydrateMongoLeads } from "../registry/registryService.js";
import { localLeadInclude, registryLeadInclude } from "./leadIdentity.js";
import { localLeadToView, registryLeadToView, type LeadView } from "./leadView.js";

export type CrmListFilters = {
  search?: string;
  phase?: string;
  claimedById?: string;
  createdById?: string;
  region?: string;
  subcity?: string;
  sector?: string | string[];
  /** LOCAL | MONGO | ALL — MONGO maps to RegistryLead shells */
  source?: string;
  campaignId?: string;
  /** Restrict campaign rows to this assignee (sales). */
  campaignAssigneeId?: string;
  /** Restrict claimed rows to this user (sales mine). */
  ownerUserId?: string;
  page?: number;
  pageSize?: number;
  orderBy?: "updatedAt" | "createdAt";
};

function phaseWhere(phase?: string): LeadPhase | undefined {
  const p = phase?.trim().toUpperCase();
  if (!p || p === "ALL") return undefined;
  if (Object.values(LeadPhase).includes(p as LeadPhase)) return p as LeadPhase;
  return undefined;
}

function localWhere(filters: CrmListFilters): Prisma.LeadWhereInput {
  const search = filters.search?.trim();
  const phase = phaseWhere(filters.phase);
  const claimedById = filters.claimedById?.trim();
  const region = filters.region?.trim();
  const subcity = filters.subcity?.trim();
  const sectors = normalizeSectorFilter(filters.sector);

  return {
    ...(filters.ownerUserId ? { claimedById: filters.ownerUserId } : {}),
    ...(phase ? { phase } : {}),
    ...(claimedById === "UNCLAIMED"
      ? { claimedById: null }
      : claimedById
        ? { claimedById }
        : {}),
    ...(filters.createdById ? { createdById: filters.createdById } : {}),
    ...(region ? { businessRegion: { equals: region, mode: "insensitive" } } : {}),
    ...(subcity ? { businessWoreda: { equals: subcity, mode: "insensitive" } } : {}),
    ...(sectors.length === 1
      ? { englishDescription: { equals: sectors[0], mode: "insensitive" } }
      : sectors.length > 1
        ? { OR: sectors.map((item) => ({ englishDescription: { equals: item, mode: "insensitive" as const } })) }
        : {}),
    ...(search
      ? {
          OR: [
            "fullName",
            "phoneNumber",
            "email",
            "businessName",
            "licenceNumber",
            "businessRegion",
            "businessWoreda",
            "englishDescription"
          ].map((field) => ({ [field]: { contains: search, mode: "insensitive" as const } }))
        }
      : {})
  };
}

function registryWhere(filters: CrmListFilters): Prisma.RegistryLeadWhereInput {
  const search = filters.search?.trim();
  const phase = phaseWhere(filters.phase);
  const claimedById = filters.claimedById?.trim();
  const region = filters.region?.trim();
  const subcity = filters.subcity?.trim();
  const sectors = normalizeSectorFilter(filters.sector);

  return {
    ...(filters.ownerUserId ? { claimedById: filters.ownerUserId } : {}),
    ...(phase ? { phase } : {}),
    ...(claimedById === "UNCLAIMED"
      ? { claimedById: null }
      : claimedById
        ? { claimedById }
        : {}),
    ...(filters.createdById ? { createdById: filters.createdById } : {}),
    ...(region ? { regionKey: { equals: region, mode: "insensitive" } } : {}),
    ...(subcity ? { subcityKey: { equals: subcity, mode: "insensitive" } } : {}),
    ...(sectors.length === 1
      ? { sectorKey: { equals: sectors[0], mode: "insensitive" } }
      : sectors.length > 1
        ? { OR: sectors.map((item) => ({ sectorKey: { equals: item, mode: "insensitive" as const } })) }
        : {}),
    ...(search
      ? {
          OR: [
            { displayName: { contains: search, mode: "insensitive" } },
            { phoneNumber: { contains: search, mode: "insensitive" } },
            { phoneKey: { contains: search.replace(/\D/g, "") || search, mode: "insensitive" } },
            { regionKey: { contains: search, mode: "insensitive" } },
            { subcityKey: { contains: search, mode: "insensitive" } },
            { sectorKey: { contains: search, mode: "insensitive" } },
            { externalBusinessId: { contains: search, mode: "insensitive" } }
          ]
        }
      : {})
  };
}

/**
 * Unified CRM list across LOCAL Lead + RegistryLead shells.
 * Source filter LOCAL/MONGO scopes to one table; otherwise both are merged.
 */
export async function listCrmLeads(filters: CrmListFilters = {}) {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 50));
  const source = filters.source?.trim().toUpperCase();
  const orderField = filters.orderBy || "updatedAt";
  const campaignId = filters.campaignId?.trim();

  // Campaign slice: resolve lead ids from CampaignLead then load shells/local.
  if (campaignId) {
    const campaignRows = await prisma.campaignLead.findMany({
      where: {
        campaignId,
        ...(filters.campaignAssigneeId ? { assignedToId: filters.campaignAssigneeId } : {}),
        leadId: { not: null }
      },
      select: { leadId: true, leadKind: true }
    });
    const localIds = campaignRows.filter((r) => r.leadKind === LeadKind.LOCAL || !r.leadKind).map((r) => r.leadId!);
    const regIds = campaignRows.filter((r) => r.leadKind === LeadKind.REGISTRY).map((r) => r.leadId!);
    // Legacy rows without leadKind: try both
    const unknownIds = campaignRows.filter((r) => !r.leadKind).map((r) => r.leadId!);

    const localWhereCamp: Prisma.LeadWhereInput = {
      ...localWhere(filters),
      id: { in: [...new Set([...localIds, ...unknownIds])] }
    };
    const regWhereCamp: Prisma.RegistryLeadWhereInput = {
      ...registryWhere(filters),
      id: { in: [...new Set([...regIds, ...unknownIds])] }
    };

    const [locals, regs] = await Promise.all([
      source === "MONGO"
        ? Promise.resolve([])
        : prisma.lead.findMany({ where: localWhereCamp, include: localLeadInclude }),
      source === "LOCAL"
        ? Promise.resolve([])
        : prisma.registryLead.findMany({ where: regWhereCamp, include: registryLeadInclude })
    ]);

    let views: LeadView[] = [
      ...locals.map((l) => localLeadToView(l)),
      ...regs.map((r) => registryLeadToView(r))
    ];
    // de-dupe by id
    const seen = new Set<string>();
    views = views.filter((v) => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
    views.sort((a, b) => {
      const av = (orderField === "createdAt" ? a.createdAt : a.updatedAt)?.getTime() || 0;
      const bv = (orderField === "createdAt" ? b.createdAt : b.updatedAt)?.getTime() || 0;
      return bv - av;
    });
    const total = views.length;
    const pageRows = views.slice((page - 1) * pageSize, page * pageSize);
    const hydrated = await hydrateMongoLeads(pageRows);
    return {
      leads: hydrated,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
    };
  }

  const includeLocal = source !== "MONGO";
  const includeRegistry = source !== "LOCAL";
  const fetchSize = page * pageSize;

  const [localRows, localTotal, regRows, regTotal] = await Promise.all([
    includeLocal
      ? prisma.lead.findMany({
          where: localWhere(filters),
          include: localLeadInclude,
          orderBy: { [orderField]: "desc" },
          take: fetchSize
        })
      : Promise.resolve([]),
    includeLocal ? prisma.lead.count({ where: localWhere(filters) }) : Promise.resolve(0),
    includeRegistry
      ? prisma.registryLead.findMany({
          where: registryWhere(filters),
          include: registryLeadInclude,
          orderBy: { [orderField]: "desc" },
          take: fetchSize
        })
      : Promise.resolve([]),
    includeRegistry ? prisma.registryLead.count({ where: registryWhere(filters) }) : Promise.resolve(0)
  ]);

  const merged: LeadView[] = [
    ...localRows.map((l) => localLeadToView(l)),
    ...regRows.map((r) => registryLeadToView(r))
  ].sort((a, b) => {
    const av = (orderField === "createdAt" ? a.createdAt : a.updatedAt)?.getTime() || 0;
    const bv = (orderField === "createdAt" ? b.createdAt : b.updatedAt)?.getTime() || 0;
    return bv - av;
  });

  const total = localTotal + regTotal;
  const pageRows = merged.slice((page - 1) * pageSize, page * pageSize);
  const hydrated = await hydrateMongoLeads(pageRows);

  return {
    leads: hydrated,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
  };
}
