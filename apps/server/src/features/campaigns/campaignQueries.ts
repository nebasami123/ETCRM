import { CampaignStatus, LeadPhase, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { countRegistryBusinessesMatching, type CampaignSortMode } from "../registry/registryService.js";
import type { CampaignFiltersSnapshot } from "./campaignTypes.js";

const campaignListInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  members: {
    include: { user: { select: { id: true, name: true, email: true } } }
  },
  _count: { select: { leads: true } }
} satisfies Prisma.CampaignInclude;

export async function listCampaigns(filters: { status?: string } = {}) {
  const status = filters.status?.trim().toUpperCase();
  const where: Prisma.CampaignWhereInput =
    status && Object.values(CampaignStatus).includes(status as CampaignStatus)
      ? { status: status as CampaignStatus }
      : {};

  const campaigns = await prisma.campaign.findMany({
    where,
    include: campaignListInclude,
    orderBy: { createdAt: "desc" }
  });

  const campaignIds = campaigns.map((c) => c.id);
  if (!campaignIds.length) return [];

  const leadIds = await prisma.campaignLead.findMany({
    where: { campaignId: { in: campaignIds }, leadId: { not: null } },
    select: { campaignId: true, leadId: true, assignedToId: true, leadKind: true }
  });

  const localIds = leadIds.filter((r) => r.leadId && (r as { leadKind?: string }).leadKind !== "REGISTRY").map((r) => r.leadId!);
  const regIds = leadIds.filter((r) => r.leadId && (r as { leadKind?: string }).leadKind === "REGISTRY").map((r) => r.leadId!);
  const unknownIds = leadIds.filter((r) => r.leadId && !(r as { leadKind?: string }).leadKind).map((r) => r.leadId!);
  const [localPhases, regPhases] = await Promise.all([
    [...new Set([...localIds, ...unknownIds])].length
      ? prisma.lead.findMany({
          where: { id: { in: [...new Set([...localIds, ...unknownIds])] } },
          select: { id: true, phase: true }
        })
      : [],
    [...new Set([...regIds, ...unknownIds])].length
      ? prisma.registryLead.findMany({
          where: { id: { in: [...new Set([...regIds, ...unknownIds])] } },
          select: { id: true, phase: true }
        })
      : []
  ]);
  const phaseByLead = new Map<string, LeadPhase>();
  for (const lead of localPhases) phaseByLead.set(lead.id, lead.phase);
  for (const lead of regPhases) phaseByLead.set(lead.id, lead.phase);

  const statsByCampaign = new Map<
    string,
    { total: number; newCount: number; contacted: number; followUp: number; na: number; won: number; lost: number }
  >();

  for (const campaign of campaigns) {
    statsByCampaign.set(campaign.id, {
      total: campaign._count.leads,
      newCount: 0,
      contacted: 0,
      followUp: 0,
      na: 0,
      won: 0,
      lost: 0
    });
  }

  for (const row of leadIds) {
    const stats = statsByCampaign.get(row.campaignId);
    if (!stats || !row.leadId) continue;
    const phase = phaseByLead.get(row.leadId);
    if (phase === LeadPhase.NEW) stats.newCount += 1;
    else if (phase === LeadPhase.CONTACTED) stats.contacted += 1;
    else if (phase === LeadPhase.FOLLOW_UP) stats.followUp += 1;
    else if (phase === LeadPhase.N_A) stats.na += 1;
    else if (phase === LeadPhase.CLOSED_WON) stats.won += 1;
    else if (phase === LeadPhase.CLOSED_LOST) stats.lost += 1;
  }

  return campaigns.map((campaign) => {
    const stats = statsByCampaign.get(campaign.id)!;
    const worked = stats.contacted + stats.followUp + stats.na + stats.won + stats.lost;
    return {
      ...campaign,
      stats: {
        ...stats,
        worked,
        progressPct: stats.total > 0 ? Math.round((worked / stats.total) * 100) : 0
      }
    };
  });
}

export async function getCampaignDetail(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: campaignListInclude
  });
  if (!campaign) return null;

  const campaignLeads = await prisma.campaignLead.findMany({
    where: { campaignId },
    select: {
      id: true,
      phoneKey: true,
      phoneNumber: true,
      fullName: true,
      businessName: true,
      capital: true,
      region: true,
      subcity: true,
      leadId: true,
      leadKind: true,
      assignedToId: true,
      assignedAt: true,
      assignedTo: { select: { id: true, name: true, email: true } }
    },
    orderBy: [{ capital: "desc" }, { fullName: "asc" }]
  });

  const localLeadIds = campaignLeads.filter((r) => r.leadId && r.leadKind !== "REGISTRY").map((r) => r.leadId!);
  const regLeadIds = campaignLeads.filter((r) => r.leadId && r.leadKind === "REGISTRY").map((r) => r.leadId!);
  const [localShells, regShells] = await Promise.all([
    localLeadIds.length
      ? prisma.lead.findMany({
          where: { id: { in: localLeadIds } },
          select: { id: true, phase: true, claimedById: true, claimedAt: true }
        })
      : [],
    regLeadIds.length
      ? prisma.registryLead.findMany({
          where: { id: { in: regLeadIds } },
          select: { id: true, phase: true, claimedById: true, claimedAt: true }
        })
      : []
  ]);
  const shellById = new Map<string, { id: string; phase: LeadPhase; claimedById: string | null; claimedAt: Date | null }>();
  for (const row of localShells) shellById.set(row.id, row);
  for (const row of regShells) shellById.set(row.id, row);

  const campaignLeadsWithPhase = campaignLeads.map((row) => ({
    ...row,
    lead: row.leadId ? shellById.get(row.leadId) ?? null : null
  }));

  const phaseCounts = {
    NEW: 0,
    CONTACTED: 0,
    FOLLOW_UP: 0,
    N_A: 0,
    CLOSED_WON: 0,
    CLOSED_LOST: 0,
    UNLINKED: 0
  };

  const byAgent = new Map<
    string,
    {
      userId: string;
      name: string;
      total: number;
      newCount: number;
      contacted: number;
      followUp: number;
      won: number;
      lost: number;
    }
  >();

  for (const member of campaign.members) {
    byAgent.set(member.userId, {
      userId: member.userId,
      name: member.user.name,
      total: 0,
      newCount: 0,
      contacted: 0,
      followUp: 0,
      won: 0,
      lost: 0
    });
  }

  for (const row of campaignLeadsWithPhase) {
    const phase = row.lead?.phase;
    if (!phase) phaseCounts.UNLINKED += 1;
    else phaseCounts[phase] += 1;

    if (!row.assignedToId) continue;
    let agent = byAgent.get(row.assignedToId);
    if (!agent) {
      agent = {
        userId: row.assignedToId,
        name: row.assignedTo?.name || "Unknown",
        total: 0,
        newCount: 0,
        contacted: 0,
        followUp: 0,
        won: 0,
        lost: 0
      };
      byAgent.set(row.assignedToId, agent);
    }
    agent.total += 1;
    if (phase === LeadPhase.NEW) agent.newCount += 1;
    else if (phase === LeadPhase.CONTACTED) agent.contacted += 1;
    else if (phase === LeadPhase.FOLLOW_UP) agent.followUp += 1;
    else if (phase === LeadPhase.CLOSED_WON) agent.won += 1;
    else if (phase === LeadPhase.CLOSED_LOST) agent.lost += 1;
  }

  const total = campaignLeadsWithPhase.length;
  const worked =
    phaseCounts.CONTACTED +
    phaseCounts.FOLLOW_UP +
    phaseCounts.N_A +
    phaseCounts.CLOSED_WON +
    phaseCounts.CLOSED_LOST;

  return {
    ...campaign,
    leads: campaignLeadsWithPhase,
    stats: {
      total,
      newCount: phaseCounts.NEW,
      contacted: phaseCounts.CONTACTED,
      followUp: phaseCounts.FOLLOW_UP,
      na: phaseCounts.N_A,
      won: phaseCounts.CLOSED_WON,
      lost: phaseCounts.CLOSED_LOST,
      unlinked: phaseCounts.UNLINKED,
      worked,
      progressPct: total > 0 ? Math.round((worked / total) * 100) : 0,
      byAgent: [...byAgent.values()].sort((a, b) => b.total - a.total)
    }
  };
}

export async function previewCampaignPool(input: {
  filters: CampaignFiltersSnapshot;
  sortMode: CampaignSortMode;
  requested: number;
}) {
  const { getExcludedPhoneKeys } = await import("./campaignExclusion.js");
  const { selectRegistryLeadsForCampaign } = await import("../registry/registryService.js");
  const excludePhoneKeys = await getExcludedPhoneKeys();
  const requested = Math.max(1, Math.min(100_000, input.requested || 50));
  const selection = await selectRegistryLeadsForCampaign({
    filters: input.filters,
    sortMode: input.sortMode,
    limit: requested,
    excludePhoneKeys
  });
  const businessCount = await countRegistryBusinessesMatching(input.filters);

  return {
    requested,
    matched: selection.candidates.length,
    scannedBusinesses: selection.scannedBusinesses,
    exhausted: selection.exhausted,
    approximateBusinesses: businessCount.total,
    businessCountAvailable: businessCount.available,
    excludedPhoneCount: excludePhoneKeys.size,
    sample: selection.candidates.slice(0, 8).map((row) => ({
      fullName: row.fullName,
      businessName: row.businessName,
      phoneNumber: row.phoneNumber,
      capital: row.capital,
      region: row.region,
      subcity: row.subcity
    }))
  };
}

export async function listSalesCampaigns(userId: string) {
  const memberships = await prisma.campaignMember.findMany({
    where: {
      userId,
      campaign: { status: { in: [CampaignStatus.ACTIVE, CampaignStatus.PAUSED] } }
    },
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
          label: true,
          description: true,
          status: true,
          assignedAt: true,
          createdAt: true
        }
      }
    },
    orderBy: { campaign: { assignedAt: "desc" } }
  });

  const campaignIds = memberships.map((m) => m.campaignId);
  if (!campaignIds.length) return [];

  const assigned = await prisma.campaignLead.findMany({
    where: { campaignId: { in: campaignIds }, assignedToId: userId, leadId: { not: null } },
    select: { campaignId: true, leadId: true }
  });

  const leadIds = assigned.map((row) => row.leadId!).filter(Boolean);
  const [localPhasesSales, regPhasesSales] = await Promise.all([
    leadIds.length
      ? prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, phase: true } })
      : [],
    leadIds.length
      ? prisma.registryLead.findMany({ where: { id: { in: leadIds } }, select: { id: true, phase: true } })
      : []
  ]);
  const phaseByLead = new Map<string, LeadPhase>();
  for (const lead of localPhasesSales) phaseByLead.set(lead.id, lead.phase);
  for (const lead of regPhasesSales) phaseByLead.set(lead.id, lead.phase);

  const statsByCampaign = new Map<string, { total: number; remaining: number; won: number; lost: number }>();
  for (const id of campaignIds) {
    statsByCampaign.set(id, { total: 0, remaining: 0, won: 0, lost: 0 });
  }
  for (const row of assigned) {
    const stats = statsByCampaign.get(row.campaignId);
    if (!stats || !row.leadId) continue;
    stats.total += 1;
    const phase = phaseByLead.get(row.leadId);
    if (phase === LeadPhase.NEW || phase === LeadPhase.CONTACTED || phase === LeadPhase.FOLLOW_UP) {
      stats.remaining += 1;
    }
    // N_A is resolved (unreachable) — not remaining, not won/lost
    if (phase === LeadPhase.CLOSED_WON) stats.won += 1;
    if (phase === LeadPhase.CLOSED_LOST) stats.lost += 1;
  }

  return memberships.map((row) => ({
    ...row.campaign,
    targetCount: row.targetCount,
    stats: statsByCampaign.get(row.campaignId) || { total: 0, remaining: 0, won: 0, lost: 0 }
  }));
}

export async function getCampaignFilterOptions() {
  const { getRegistryFilterOptions } = await import("../registry/registryService.js");
  return getRegistryFilterOptions();
}

/** Campaign-level performance snapshot for the admin Performance page. */
export async function getCampaignAnalytics() {
  const campaigns = await prisma.campaign.findMany({
    where: { status: { in: [CampaignStatus.ACTIVE, CampaignStatus.PAUSED, CampaignStatus.CLOSED] } },
    include: {
      members: { include: { user: { select: { id: true, name: true } } } },
      _count: { select: { leads: true } }
    },
    orderBy: { assignedAt: "desc" },
    take: 50
  });

  const campaignIds = campaigns.map((c) => c.id);
  if (!campaignIds.length) return [];

  const rows = await prisma.campaignLead.findMany({
    where: { campaignId: { in: campaignIds }, leadId: { not: null } },
    select: {
      campaignId: true,
      assignedToId: true,
      leadId: true,
      leadKind: true
    }
  });
  const analyticsLeadIds = rows.map((r) => r.leadId!).filter(Boolean);
  const [localAnalytics, regAnalytics] = await Promise.all([
    analyticsLeadIds.length
      ? prisma.lead.findMany({ where: { id: { in: analyticsLeadIds } }, select: { id: true, phase: true } })
      : [],
    analyticsLeadIds.length
      ? prisma.registryLead.findMany({ where: { id: { in: analyticsLeadIds } }, select: { id: true, phase: true } })
      : []
  ]);
  const analyticsPhase = new Map<string, LeadPhase>();
  for (const lead of localAnalytics) analyticsPhase.set(lead.id, lead.phase);
  for (const lead of regAnalytics) analyticsPhase.set(lead.id, lead.phase);

  const byCampaign = new Map<
    string,
    { total: number; newCount: number; working: number; won: number; lost: number }
  >();
  for (const id of campaignIds) {
    byCampaign.set(id, { total: 0, newCount: 0, working: 0, won: 0, lost: 0 });
  }
  for (const row of rows) {
    const stats = byCampaign.get(row.campaignId);
    const phase = row.leadId ? analyticsPhase.get(row.leadId) : undefined;
    if (!stats || !phase) continue;
    stats.total += 1;
    if (phase === LeadPhase.NEW) stats.newCount += 1;
    else if (phase === LeadPhase.CONTACTED || phase === LeadPhase.FOLLOW_UP) stats.working += 1;
    else if (phase === LeadPhase.N_A) stats.working += 1;
    else if (phase === LeadPhase.CLOSED_WON) stats.won += 1;
    else if (phase === LeadPhase.CLOSED_LOST) stats.lost += 1;
  }

  return campaigns.map((campaign) => {
    const stats = byCampaign.get(campaign.id) || { total: 0, newCount: 0, working: 0, won: 0, lost: 0 };
    const decided = stats.won + stats.lost;
    const worked = stats.working + decided;
    return {
      id: campaign.id,
      name: campaign.name,
      label: campaign.label,
      status: campaign.status,
      durationDays: campaign.durationDays,
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      assignedAt: campaign.assignedAt,
      agentCount: campaign.members.length,
      stats: {
        ...stats,
        worked,
        progressPct: stats.total > 0 ? Math.round((worked / stats.total) * 100) : 0,
        winRate: decided > 0 ? Math.round((stats.won / decided) * 100) : 0
      }
    };
  });
}
