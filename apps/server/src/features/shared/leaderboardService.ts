import { ActivityType, LeadPhase } from "@prisma/client";
import { prisma } from "../../config/db.js";

export interface LeaderboardEntry {
  userId: string;
  name: string;
  claimedLeads: number;
  conversions: number;
  losses: number;
  inProgress: number;
  conversionRate: number;
  callNotes: number;
  totalActivity: number;
}

/**
 * Shared leaderboard builder used by both sales and admin views.
 *
 * Formula:  conversionRate = WON / (WON + LOST + IN_PROGRESS) × 100
 *   - WON / LOST: counted from ActivityEvent via creditedUserId
 *   - IN_PROGRESS: leads in CONTACTED or FOLLOW_UP phase, claimed by agent
 *   - Excluded: NEW (not contacted), N_A (unanswered)
 *
 * @param opts.from  Optional start date for activity-based queries
 * @param opts.to    Optional end   date for activity-based queries
 */
export async function buildLeaderboard(opts?: { from?: Date; to?: Date }): Promise<LeaderboardEntry[]> {
  const users = await prisma.user.findMany({
    where: { role: "SALES" },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });
  if (!users.length) return [];

  const userIds = users.map((u) => u.id);
  const dateFilter = opts?.from || opts?.to
    ? { createdAt: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } }
    : {};

  const [
    localClaimed,
    regClaimed,
    conversionCredits,
    callNotes,
    activityCounts,
    localInProgress,
    regInProgress
  ] = await Promise.all([
    // Claimed leads (all-time — cumulative metric)
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
    // WON + LOST credits (time-scopeable)
    prisma.activityEvent.groupBy({
      by: ["creditedUserId", "toPhase"],
      where: {
        type: ActivityType.PHASE_CHANGED,
        creditedUserId: { in: userIds },
        toPhase: { in: [LeadPhase.CLOSED_WON, LeadPhase.CLOSED_LOST] },
        ...dateFilter
      },
      _count: { _all: true }
    }),
    // Call notes (time-scopeable)
    prisma.activityEvent.groupBy({
      by: ["actorId"],
      where: { actorId: { in: userIds }, type: ActivityType.CALL_NOTE, ...dateFilter },
      _count: { _all: true }
    }),
    // Total activity (time-scopeable)
    prisma.activityEvent.groupBy({
      by: ["actorId"],
      where: { actorId: { in: userIds }, ...dateFilter },
      _count: { _all: true }
    }),
    // In-progress: CONTACTED or FOLLOW_UP leads (current state, all-time)
    prisma.lead.groupBy({
      by: ["claimedById"],
      where: {
        claimedById: { in: userIds },
        phase: { in: [LeadPhase.CONTACTED, LeadPhase.FOLLOW_UP] }
      },
      _count: { _all: true }
    }),
    prisma.registryLead.groupBy({
      by: ["claimedById"],
      where: {
        claimedById: { in: userIds },
        phase: { in: [LeadPhase.CONTACTED, LeadPhase.FOLLOW_UP] }
      },
      _count: { _all: true }
    })
  ]);

  // ── Build lookup maps ──
  const claimedMap = new Map<string, number>();
  for (const row of [...localClaimed, ...regClaimed]) {
    if (!row.claimedById) continue;
    claimedMap.set(row.claimedById, (claimedMap.get(row.claimedById) || 0) + row._count._all);
  }

  const wonMap = new Map<string, number>();
  const lostMap = new Map<string, number>();
  for (const row of conversionCredits) {
    if (!row.creditedUserId) continue;
    if (row.toPhase === LeadPhase.CLOSED_WON) wonMap.set(row.creditedUserId, row._count._all);
    if (row.toPhase === LeadPhase.CLOSED_LOST) lostMap.set(row.creditedUserId, row._count._all);
  }

  const inProgressMap = new Map<string, number>();
  for (const row of [...localInProgress, ...regInProgress]) {
    if (!row.claimedById) continue;
    inProgressMap.set(row.claimedById, (inProgressMap.get(row.claimedById) || 0) + row._count._all);
  }

  const callMap = new Map(callNotes.map((row) => [row.actorId, row._count._all]));
  const activityMap = new Map(activityCounts.map((row) => [row.actorId, row._count._all]));

  // ── Assemble entries ──
  return users.map((user) => {
    const conversions = wonMap.get(user.id) || 0;
    const losses = lostMap.get(user.id) || 0;
    const inProgress = inProgressMap.get(user.id) || 0;
    const denominator = conversions + losses + inProgress;
    return {
      userId: user.id,
      name: user.name,
      claimedLeads: claimedMap.get(user.id) || 0,
      conversions,
      losses,
      inProgress,
      conversionRate: denominator > 0 ? Math.round((conversions / denominator) * 100) : 0,
      callNotes: callMap.get(user.id) || 0,
      totalActivity: activityMap.get(user.id) || 0
    };
  });
}
