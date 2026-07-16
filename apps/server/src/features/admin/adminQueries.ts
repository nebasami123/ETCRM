import { ActivityType, LeadPhase, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { businessDate, endOfBusinessDay, parseBusinessDate, startOfBusinessDay } from "../../utils/dates.js";
import { leadDetailInclude } from "../leads/leadService.js";

const salesOnly = { role: "SALES" };

export async function getAdminSummary() {
  const today = startOfBusinessDay();
  const [leads, salesUsers, won, lost, followUps, unclaimed, salesCreatedToday, pendingTransfers] = await Promise.all([
    prisma.lead.count(),
    prisma.user.count({ where: salesOnly }),
    prisma.lead.count({ where: { phase: LeadPhase.CLOSED_WON } }),
    prisma.lead.count({ where: { phase: LeadPhase.CLOSED_LOST } }),
    prisma.lead.count({ where: { phase: LeadPhase.FOLLOW_UP } }),
    prisma.lead.count({ where: { claimedById: null } }),
    prisma.lead.count({ where: { createdAt: { gte: today }, createdBy: salesOnly } }),
    prisma.claimTransferRequest.count({ where: { status: "PENDING" } })
  ]);
  return { leads, salesUsers, won, lost, followUps, unclaimed, salesCreatedToday, pendingTransfers };
}

/** Full-population aggregates for overview charts (not page-limited). */
export async function getAdminOverviewAggregates() {
  const [phaseGroups, claimedByPhaseGroups, activityGroups, salesUsers] = await Promise.all([
    prisma.lead.groupBy({ by: ["phase"], _count: { _all: true } }),
    prisma.lead.groupBy({
      by: ["claimedById", "phase"],
      where: { claimedById: { not: null } },
      _count: { _all: true }
    }),
    prisma.activityEvent.groupBy({ by: ["type"], _count: { _all: true } }),
    prisma.user.findMany({
      where: salesOnly,
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    })
  ]);

  const phaseCounts = (Object.values(LeadPhase) as LeadPhase[]).map((phase) => ({
    phase,
    count: phaseGroups.find((g) => g.phase === phase)?._count._all ?? 0
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
  page?: number;
  pageSize?: number;
}) {
  const search = filters.search?.trim();
  const phase = filters.phase?.trim();
  const claimedById = filters.claimedById?.trim();
  const where: Prisma.LeadWhereInput = {
    ...(phase && phase !== "ALL" && Object.values(LeadPhase).includes(phase as LeadPhase) ? { phase: phase as LeadPhase } : {}),
    ...(claimedById === "UNCLAIMED" ? { claimedById: null } : claimedById ? { claimedById } : {}),
    ...(filters.createdById ? { createdById: filters.createdById } : {}),
    ...(search
      ? {
          OR: ["fullName", "phoneNumber", "email", "businessName", "licenceNumber", "businessRegion", "businessWoreda"].map(
            (field) => ({ [field]: { contains: search, mode: "insensitive" } })
          )
        }
      : {})
  };
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 50));
  const [leads, total] = await prisma.$transaction([
    prisma.lead.findMany({
      where,
      include: leadDetailInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.lead.count({ where })
  ]);
  return { leads, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function listAdminActivity(input: { limit?: unknown; page?: unknown }) {
  const limit = Math.min(100, Math.max(1, Number(input.limit || 30)));
  const page = Math.max(1, Number(input.page || 1));
  const [activities, total] = await prisma.$transaction([
    prisma.activityEvent.findMany({
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
        creditedUser: { select: { id: true, name: true } },
        lead: { select: { id: true, fullName: true, phoneNumber: true, phase: true } }
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.activityEvent.count()
  ]);
  return { activities, pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function listAdminQuotas(dateInput: unknown) {
  return prisma.quota.findMany({
    where: { date: parseBusinessDate(dateInput) },
    include: { salesUser: { select: { id: true, name: true, email: true } } },
    orderBy: { salesUser: { name: "asc" } }
  });
}

export async function listClaimTransferRequests(status = "PENDING") {
  return prisma.claimTransferRequest.findMany({
    where: status === "ALL" ? {} : { status: status as Prisma.EnumClaimRequestStatusFilter["equals"] },
    include: {
      lead: {
        select: {
          id: true,
          fullName: true,
          phoneNumber: true,
          claimedBy: { select: { id: true, name: true } }
        }
      },
      requestedBy: { select: { id: true, name: true, email: true } },
      resolvedBy: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });
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

  const [claimedCounts, conversionCredits, callNotes, activityCounts] = await Promise.all([
    prisma.lead.groupBy({
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

  const claimedMap = new Map(claimedCounts.map((row) => [row.claimedById!, row._count._all]));
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
