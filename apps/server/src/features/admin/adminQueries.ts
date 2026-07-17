import { ActivityType, LeadPhase, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { businessDate, endOfBusinessDay, parseBusinessDate, startOfBusinessDay } from "../../utils/dates.js";
const salesOnly = { role: "SALES" };

/**
 * Live Mongo phones are normal NEW leads in the product model.
 * Postgres only stores shells once a lead is claimed/worked (plus local creates/imports).
 * Overview totals therefore combine live Mongo volume with CRM phase progress.
 */
async function getLiveLeadUniverseSize() {
  try {
    const registry = await import("../registry/registryService.js").then((m) => m.getRegistrySummary());
    return { total: registry.totalBusinesses, available: registry.available };
  } catch {
    return { total: 0, available: false as const };
  }
}

export async function getAdminSummary() {
  const today = startOfBusinessDay();
  const [
    localLeads,
    regLeads,
    salesUsers,
    localWon,
    regWon,
    localLost,
    regLost,
    localFollow,
    regFollow,
    localClaimed,
    regClaimed,
    salesCreatedToday,
    pendingTransfers,
    live
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.registryLead.count(),
    prisma.user.count({ where: salesOnly }),
    prisma.lead.count({ where: { phase: LeadPhase.CLOSED_WON } }),
    prisma.registryLead.count({ where: { phase: LeadPhase.CLOSED_WON } }),
    prisma.lead.count({ where: { phase: LeadPhase.CLOSED_LOST } }),
    prisma.registryLead.count({ where: { phase: LeadPhase.CLOSED_LOST } }),
    prisma.lead.count({ where: { phase: LeadPhase.FOLLOW_UP } }),
    prisma.registryLead.count({ where: { phase: LeadPhase.FOLLOW_UP } }),
    prisma.lead.count({ where: { claimedById: { not: null } } }),
    prisma.registryLead.count({ where: { claimedById: { not: null } } }),
    prisma.lead.count({ where: { createdAt: { gte: today }, createdBy: salesOnly } }),
    prisma.claimTransferRequest.count({ where: { status: "PENDING" } }),
    getLiveLeadUniverseSize()
  ]);

  const crmLeads = localLeads + regLeads;
  const won = localWon + regWon;
  const lost = localLost + regLost;
  const followUps = localFollow + regFollow;
  const claimed = localClaimed + regClaimed;
  // Single lead total: live directory universe is the NEW pool; never under-count CRM rows if directory is down.
  const leads = Math.max(live.total, crmLeads);
  const unclaimed = Math.max(0, leads - claimed);

  return {
    leads,
    salesUsers,
    won,
    lost,
    followUps,
    unclaimed,
    salesCreatedToday,
    pendingTransfers
  };
}

/** Full-population aggregates for overview charts (not page-limited). */
export async function getAdminOverviewAggregates() {
  const [localPhases, regPhases, localClaimedByPhase, regClaimedByPhase, activityGroups, salesUsers, live] =
    await Promise.all([
      prisma.lead.groupBy({ by: ["phase"], _count: { _all: true } }),
      prisma.registryLead.groupBy({ by: ["phase"], _count: { _all: true } }),
      prisma.lead.groupBy({
        by: ["claimedById", "phase"],
        where: { claimedById: { not: null } },
        _count: { _all: true }
      }),
      prisma.registryLead.groupBy({
        by: ["claimedById", "phase"],
        where: { claimedById: { not: null } },
        _count: { _all: true }
      }),
      prisma.activityEvent.groupBy({ by: ["type"], _count: { _all: true } }),
      prisma.user.findMany({
        where: salesOnly,
        select: { id: true, name: true },
        orderBy: { name: "asc" }
      }),
      getLiveLeadUniverseSize()
    ]);

  const phaseGroups = [...localPhases, ...regPhases];
  const claimedByPhaseGroups = [...localClaimedByPhase, ...regClaimedByPhase];
  const crmPhaseCount = (phase: LeadPhase) =>
    phaseGroups.filter((g) => g.phase === phase).reduce((sum, g) => sum + g._count._all, 0);
  const crmNonNew =
    crmPhaseCount(LeadPhase.CONTACTED) +
    crmPhaseCount(LeadPhase.FOLLOW_UP) +
    crmPhaseCount(LeadPhase.N_A) +
    crmPhaseCount(LeadPhase.CLOSED_WON) +
    crmPhaseCount(LeadPhase.CLOSED_LOST);
  const crmTotal = phaseGroups.reduce((sum, row) => sum + row._count._all, 0);
  const universe = Math.max(live.total, crmTotal);
  // Everything in the live universe that is not already advanced in CRM is still NEW.
  const newCount = Math.max(crmPhaseCount(LeadPhase.NEW), universe - crmNonNew);

  const phaseCounts = (Object.values(LeadPhase) as LeadPhase[]).map((phase) => ({
    phase,
    count: phase === LeadPhase.NEW ? newCount : crmPhaseCount(phase)
  }));

  const outcomeByUser = new Map<string, { won: number; lost: number; pending: number }>();
  for (const row of claimedByPhaseGroups) {
    if (!row.claimedById) continue;
    const current = outcomeByUser.get(row.claimedById) || { won: 0, lost: 0, pending: 0 };
    if (row.phase === LeadPhase.CLOSED_WON) current.won += row._count._all;
    else if (row.phase === LeadPhase.CLOSED_LOST) current.lost += row._count._all;
    else current.pending += row._count._all;
    outcomeByUser.set(row.claimedById, current);
  }

  const agentOutcomes = salesUsers
    .map((user) => {
      const outcome = outcomeByUser.get(user.id) || { won: 0, lost: 0, pending: 0 };
      return {
        userId: user.id,
        name: user.name,
        won: outcome.won,
        lost: outcome.lost,
        pending: outcome.pending
      };
    })
    .sort((a, b) => b.won + b.lost + b.pending - (a.won + a.lost + a.pending));

  const activityMix = activityGroups
    .map((g) => ({ type: g.type, count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  return { phaseCounts, agentOutcomes, activityMix };
}

export async function listAdminSalesUsers() {
  return prisma.user.findMany({
    where: salesOnly,
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" }
  });
}

export async function listAllAdminUsers() {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" }
  });
}

export async function listAdminLeads(filters: {
  search?: string;
  phase?: string;
  claimedById?: string;
  createdById?: string;
  region?: string;
  subcity?: string;
  sector?: string | string[];
  source?: string;
  page?: number;
  pageSize?: number;
}) {
  const { listLiveMongoLeads, shouldUseLiveMongoList } = await import("../leads/unifiedLeadService.js");
  const { normalizeSectorFilter } = await import("../registry/registryService.js");
  const sectors = normalizeSectorFilter(filters.sector);
  // Live Mongo feed is the default "all leads" universe (unique phones as NEW).
  // Skip it when admin is managing CRM-only slices (claimer, creator, advanced phases, local-only).
  if (!filters.createdById && shouldUseLiveMongoList(filters)) {
    const live = await listLiveMongoLeads({
      search: filters.search,
      region: filters.region,
      subcity: filters.subcity,
      sector: sectors,
      phase: filters.phase,
      claimedById: filters.claimedById,
      page: filters.page,
      pageSize: filters.pageSize
    });
    return {
      leads: live.leads,
      pagination: {
        page: live.pagination.page,
        pageSize: live.pagination.pageSize,
        total: live.pagination.total,
        totalPages: live.pagination.totalPages
      }
    };
  }

  const { listCrmLeads } = await import("../leads/crmListService.js");
  return listCrmLeads({
    search: filters.search,
    phase: filters.phase,
    claimedById: filters.claimedById,
    createdById: filters.createdById,
    region: filters.region,
    subcity: filters.subcity,
    sector: sectors,
    source: filters.source,
    page: filters.page,
    pageSize: filters.pageSize,
    orderBy: "createdAt"
  });
}

export async function listAdminActivity(input: { limit?: unknown; page?: unknown }) {
  const limit = Math.min(100, Math.max(1, Number(input.limit || 30)));
  const page = Math.max(1, Number(input.page || 1));
  const [activities, total] = await prisma.$transaction([
    prisma.activityEvent.findMany({
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
        creditedUser: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.activityEvent.count()
  ]);

  const localIds = activities.filter((a) => a.leadKind === "LOCAL" && a.leadId).map((a) => a.leadId!);
  const regIds = activities.filter((a) => a.leadKind === "REGISTRY" && a.leadId).map((a) => a.leadId!);
  const [locals, regs] = await Promise.all([
    localIds.length
      ? prisma.lead.findMany({
          where: { id: { in: localIds } },
          select: { id: true, fullName: true, phoneNumber: true, phase: true }
        })
      : [],
    regIds.length
      ? prisma.registryLead.findMany({
          where: { id: { in: regIds } },
          select: { id: true, displayName: true, phoneNumber: true, phase: true }
        })
      : []
  ]);
  const leadMap = new Map<string, { id: string; fullName: string; phoneNumber: string; phase: string }>();
  for (const l of locals) leadMap.set(l.id, l);
  for (const l of regs) {
    leadMap.set(l.id, { id: l.id, fullName: l.displayName, phoneNumber: l.phoneNumber, phase: l.phase });
  }

  return {
    activities: activities.map((a) => ({
      ...a,
      lead: a.leadId ? leadMap.get(a.leadId) ?? null : null
    })),
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) }
  };
}

export async function listAdminQuotas(dateInput: unknown) {
  return prisma.quota.findMany({
    where: { date: parseBusinessDate(dateInput) },
    include: { salesUser: { select: { id: true, name: true, email: true } } },
    orderBy: { salesUser: { name: "asc" } }
  });
}

export async function listClaimTransferRequests(status = "PENDING") {
  const rows = await prisma.claimTransferRequest.findMany({
    where: status === "ALL" ? {} : { status: status as Prisma.EnumClaimRequestStatusFilter["equals"] },
    include: {
      requestedBy: { select: { id: true, name: true, email: true } },
      resolvedBy: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  const localIds = rows.filter((r) => r.leadKind === "LOCAL").map((r) => r.leadId);
  const regIds = rows.filter((r) => r.leadKind === "REGISTRY").map((r) => r.leadId);
  const [locals, regs] = await Promise.all([
    localIds.length
      ? prisma.lead.findMany({
          where: { id: { in: localIds } },
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
            claimedBy: { select: { id: true, name: true } }
          }
        })
      : [],
    regIds.length
      ? prisma.registryLead.findMany({
          where: { id: { in: regIds } },
          select: {
            id: true,
            displayName: true,
            phoneNumber: true,
            claimedBy: { select: { id: true, name: true } }
          }
        })
      : []
  ]);
  const leadMap = new Map<
    string,
    { id: string; fullName: string; phoneNumber: string; claimedBy: { id: string; name: string } | null }
  >();
  for (const l of locals) leadMap.set(l.id, l);
  for (const l of regs) {
    leadMap.set(l.id, {
      id: l.id,
      fullName: l.displayName,
      phoneNumber: l.phoneNumber,
      claimedBy: l.claimedBy
    });
  }

  return rows.map((row) => ({
    ...row,
    lead: leadMap.get(row.leadId) ?? {
      id: row.leadId,
      fullName: "Unknown lead",
      phoneNumber: "",
      claimedBy: null
    }
  }));
}

export async function countPendingTransfers() {
  return prisma.claimTransferRequest.count({ where: { status: "PENDING" } });
}

/** Leaderboard via SQL aggregates — does not load full event arrays per user. */
export async function getLeaderboard() {
  const users = await prisma.user.findMany({
    where: salesOnly,
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });
  if (!users.length) return [];

  const userIds = users.map((u) => u.id);

  const [localClaimed, regClaimed, conversionCredits, callNotes, activityCounts] = await Promise.all([
    prisma.lead.groupBy({
      by: ["claimedById"],
      where: { claimedById: { in: userIds } },
      _count: { _all: true }
    }),
    prisma.registryLead.groupBy({
      by: ["claimedById"],
      where: { claimedById: { in: userIds } },
      _count: { _all: true }
    }),
    prisma.activityEvent.groupBy({
      by: ["creditedUserId", "toPhase"],
      where: {
        type: ActivityType.PHASE_CHANGED,
        creditedUserId: { in: userIds },
        toPhase: { in: [LeadPhase.CLOSED_WON, LeadPhase.CLOSED_LOST] }
      },
      _count: { _all: true }
    }),
    prisma.activityEvent.groupBy({
      by: ["actorId"],
      where: { actorId: { in: userIds }, type: ActivityType.CALL_NOTE },
      _count: { _all: true }
    }),
    prisma.activityEvent.groupBy({
      by: ["actorId"],
      where: { actorId: { in: userIds } },
      _count: { _all: true }
    })
  ]);

  const claimedMap = new Map<string, number>();
  for (const row of [...localClaimed, ...regClaimed]) {
    if (!row.claimedById) continue;
    claimedMap.set(row.claimedById, (claimedMap.get(row.claimedById) || 0) + row._count._all);
  }
  const callMap = new Map(callNotes.map((row) => [row.actorId, row._count._all]));
  const activityMap = new Map(activityCounts.map((row) => [row.actorId, row._count._all]));
  const wonMap = new Map<string, number>();
  const lostMap = new Map<string, number>();
  for (const row of conversionCredits) {
    if (!row.creditedUserId) continue;
    if (row.toPhase === LeadPhase.CLOSED_WON) wonMap.set(row.creditedUserId, row._count._all);
    if (row.toPhase === LeadPhase.CLOSED_LOST) lostMap.set(row.creditedUserId, row._count._all);
  }

  return users.map((user) => {
    const conversions = wonMap.get(user.id) || 0;
    const losses = lostMap.get(user.id) || 0;
    const totalDecisions = conversions + losses;
    return {
      userId: user.id,
      name: user.name,
      claimedLeads: claimedMap.get(user.id) || 0,
      conversions,
      losses,
      conversionRate: totalDecisions > 0 ? Math.round((conversions / totalDecisions) * 100) : 0,
      callNotes: callMap.get(user.id) || 0,
      totalActivity: activityMap.get(user.id) || 0
    };
  });
}

export async function getAdminReportRows({ fromInput, toInput }: { fromInput: unknown; toInput: unknown }) {
  const from = fromInput ? startOfBusinessDay(new Date(String(fromInput))) : startOfBusinessDay(new Date(Date.now() - 6 * 86_400_000));
  const to = toInput ? endOfBusinessDay(new Date(String(toInput))) : endOfBusinessDay();
  const users = await prisma.user.findMany({
    where: salesOnly,
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" }
  });
  if (!users.length) return [];

  const userIds = users.map((u) => u.id);
  const fromDate = parseBusinessDate(businessDate(from));
  const toDate = parseBusinessDate(businessDate(to));

  const [claimedCounts, createdCounts, callNotes, activityCounts, conversionCredits, quotas] = await Promise.all([
    prisma.lead.groupBy({
      by: ["claimedById"],
      where: { claimedById: { in: userIds } },
      _count: { _all: true }
    }),
    prisma.lead.groupBy({
      by: ["createdById"],
      where: { createdById: { in: userIds }, createdAt: { gte: from, lte: to } },
      _count: { _all: true }
    }),
    prisma.activityEvent.groupBy({
      by: ["actorId"],
      where: { actorId: { in: userIds }, type: ActivityType.CALL_NOTE, createdAt: { gte: from, lte: to } },
      _count: { _all: true }
    }),
    prisma.activityEvent.groupBy({
      by: ["actorId"],
      where: { actorId: { in: userIds }, createdAt: { gte: from, lte: to } },
      _count: { _all: true }
    }),
    prisma.activityEvent.groupBy({
      by: ["creditedUserId"],
      where: {
        type: ActivityType.PHASE_CHANGED,
        toPhase: LeadPhase.CLOSED_WON,
        creditedUserId: { in: userIds },
        createdAt: { gte: from, lte: to }
      },
      _count: { _all: true }
    }),
    prisma.quota.groupBy({
      by: ["salesUserId"],
      where: { salesUserId: { in: userIds }, date: { gte: fromDate, lte: toDate } },
      _count: { _all: true },
      _sum: { callsTarget: true, leadsTarget: true }
    })
  ]);

  const claimedMap = new Map(claimedCounts.map((r) => [r.claimedById!, r._count._all]));
  const createdMap = new Map(createdCounts.map((r) => [r.createdById!, r._count._all]));
  const callMap = new Map(callNotes.map((r) => [r.actorId, r._count._all]));
  const activityMap = new Map(activityCounts.map((r) => [r.actorId, r._count._all]));
  const conversionMap = new Map(conversionCredits.map((r) => [r.creditedUserId!, r._count._all]));
  const quotaMap = new Map(
    quotas.map((r) => [
      r.salesUserId,
      {
        days: r._count._all,
        calls: r._sum.callsTarget || 0,
        leads: r._sum.leadsTarget || 0
      }
    ])
  );

  return users.map((user) => {
    const q = quotaMap.get(user.id);
    return {
      agent: user.name,
      email: user.email,
      claimedLeads: claimedMap.get(user.id) || 0,
      createdLeads: createdMap.get(user.id) || 0,
      callNotes: callMap.get(user.id) || 0,
      activities: activityMap.get(user.id) || 0,
      conversionsCredited: conversionMap.get(user.id) || 0,
      quotaDays: q?.days || 0,
      totalCallTarget: q?.calls || 0,
      totalLeadTarget: q?.leads || 0
    };
  });
}
