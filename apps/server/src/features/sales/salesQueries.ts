import { ActivityType, CampaignStatus, LeadPhase, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { endOfBusinessDay, parseBusinessDate, startOfBusinessDay, taskWindow } from "../../utils/dates.js";
const UNCLAIMED_PHONE_PLACEHOLDER = "+251 91 000 0000";
const UNCLAIMED_EMAIL_PLACEHOLDER = "lead@ethiopia.example";

/**
 * Sales users may browse unclaimed leads, but their actual contact details are
 * only returned after somebody claims the lead. Keeping this at the API
 * boundary prevents the real values from being exposed in browser tools.
 */
function maskUnclaimedContact<T extends { claimedById?: string | null; phoneNumber?: string | null; email?: string | null }>(
  lead: T
) {
  if (lead.claimedById) return { ...lead, contactMasked: false };

  return {
    ...lead,
    phoneNumber: UNCLAIMED_PHONE_PLACEHOLDER,
    email: UNCLAIMED_EMAIL_PLACEHOLDER,
    contactMasked: true
  };
}

export async function getSalesDashboard(userId: string) {
  const today = startOfBusinessDay();
  const endToday = endOfBusinessDay();
  const { localLeadToView, registryLeadToView } = await import("../leads/leadView.js");
  const { localLeadInclude, registryLeadInclude } = await import("../leads/leadIdentity.js");
  const [quota, callsCompleted, processedLeads, localTodos, regTodos, localPhases, regPhases, reminders, localOverdue, regOverdue] =
    await Promise.all([
      prisma.quota.findUnique({ where: { salesUserId_date: { salesUserId: userId, date: parseBusinessDate() } } }),
      prisma.activityEvent.count({
        where: { actorId: userId, type: ActivityType.CALL_NOTE, createdAt: { gte: today, lte: endToday } }
      }),
      prisma.activityEvent.findMany({
        where: { actorId: userId, leadId: { not: null }, createdAt: { gte: today, lte: endToday } },
        distinct: ["leadId"],
        select: { leadId: true }
      }),
      prisma.lead.findMany({
        where: {
          claimedById: userId,
          OR: [
            { nextFollowUpAt: { gte: today, lte: endToday } },
            { appointmentDate: { gte: today, lte: endToday } },
            { phase: LeadPhase.NEW }
          ]
        },
        include: localLeadInclude,
        orderBy: [{ appointmentDate: "asc" }, { nextFollowUpAt: "asc" }, { createdAt: "desc" }],
        take: 100
      }),
      prisma.registryLead.findMany({
        where: {
          claimedById: userId,
          OR: [
            { nextFollowUpAt: { gte: today, lte: endToday } },
            { appointmentDate: { gte: today, lte: endToday } },
            { phase: LeadPhase.NEW }
          ]
        },
        include: registryLeadInclude,
        orderBy: [{ appointmentDate: "asc" }, { nextFollowUpAt: "asc" }, { createdAt: "desc" }],
        take: 100
      }),
      prisma.lead.groupBy({ by: ["phase"], where: { claimedById: userId }, _count: { phase: true } }),
      prisma.registryLead.groupBy({ by: ["phase"], where: { claimedById: userId }, _count: { phase: true } }),
      prisma.reminder.findMany({
        where: { userId, completedAt: null, dueAt: { gte: today, lte: endToday } },
        orderBy: { dueAt: "asc" },
        take: 5
      }),
      prisma.lead.findMany({
        where: {
          claimedById: userId,
          nextFollowUpAt: { lt: today },
          phase: { notIn: [LeadPhase.CLOSED_WON, LeadPhase.CLOSED_LOST, LeadPhase.N_A] }
        },
        select: { id: true, fullName: true, nextFollowUpAt: true, phase: true },
        orderBy: { nextFollowUpAt: "asc" },
        take: 20
      }),
      prisma.registryLead.findMany({
        where: {
          claimedById: userId,
          nextFollowUpAt: { lt: today },
          phase: { notIn: [LeadPhase.CLOSED_WON, LeadPhase.CLOSED_LOST, LeadPhase.N_A] }
        },
        select: { id: true, displayName: true, nextFollowUpAt: true, phase: true },
        orderBy: { nextFollowUpAt: "asc" },
        take: 20
      })
    ]);

  const phaseMap = new Map<LeadPhase, number>();
  for (const row of [...localPhases, ...regPhases]) {
    phaseMap.set(row.phase, (phaseMap.get(row.phase) || 0) + row._count.phase);
  }
  const phaseCounts = [...phaseMap.entries()].map(([phase, count]) => ({ phase, _count: { phase: count } }));

  const todoLeads = [
    ...localTodos.map((row) => localLeadToView(row)),
    ...regTodos.map((row) => registryLeadToView(row))
  ].slice(0, 100);
  const overdueFollowUps = [
    ...localOverdue,
    ...regOverdue.map((r) => ({
      id: r.id,
      fullName: r.displayName,
      nextFollowUpAt: r.nextFollowUpAt,
      phase: r.phase
    }))
  ]
    .sort((a, b) => (a.nextFollowUpAt?.getTime() || 0) - (b.nextFollowUpAt?.getTime() || 0))
    .slice(0, 20);

  return {
    quota: quota || { callsTarget: 0, leadsTarget: 0, date: parseBusinessDate() },
    progress: { callsCompleted, leadsProcessed: processedLeads.length },
    todoLeads,
    phaseCounts,
    reminders,
    overdueFollowUps,
    overdueCount: overdueFollowUps.length
  };
}

export async function getSalesLeaderboard(userId: string) {
  const users = await prisma.user.findMany({
    where: { role: "SALES" },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });
  if (!users.length) return { leaderboard: [], myStats: null };

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

  const leaderboard = users.map((user) => {
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

  const myStats = leaderboard.find((e) => e.userId === userId) || null;
  return { leaderboard, myStats };
}

export async function listSalesLeads(
  userId: string,
  filters: {
    search?: string;
    phase?: string;
    scope?: string;
    region?: string;
    subcity?: string;
    sector?: string | string[];
    source?: string;
    campaignId?: string;
    page?: number;
    pageSize?: number;
  }
) {
  const campaignId = filters.campaignId?.trim();
  const { listLiveMongoLeads, shouldUseLiveMongoList } = await import("../leads/unifiedLeadService.js");
  const { normalizeSectorFilter } = await import("../registry/registryService.js");
  const sectors = normalizeSectorFilter(filters.sector);
  // Campaign slices are always CRM-materialized rows owned by the agent.
  if (!campaignId && shouldUseLiveMongoList(filters)) {
    const live = await listLiveMongoLeads({
      search: filters.search,
      region: filters.region,
      subcity: filters.subcity,
      sector: sectors,
      phase: filters.phase,
      page: filters.page,
      pageSize: filters.pageSize
    });
    return {
      leads: live.leads.map(maskUnclaimedContact),
      pagination: {
        page: live.pagination.page,
        pageSize: live.pagination.pageSize,
        total: live.pagination.total,
        totalPages: live.pagination.totalPages
      }
    };
  }

  const { listCrmLeads } = await import("../leads/crmListService.js");
  const result = await listCrmLeads({
    search: filters.search,
    phase: filters.phase,
    region: filters.region,
    subcity: filters.subcity,
    sector: sectors,
    source: filters.source,
    campaignId,
    campaignAssigneeId: campaignId ? userId : undefined,
    ownerUserId: filters.scope === "mine" || campaignId ? userId : undefined,
    page: filters.page,
    pageSize: filters.pageSize,
    orderBy: "updatedAt"
  });
  return {
    leads: result.leads.map(maskUnclaimedContact),
    pagination: result.pagination
  };
}

export async function getSalesTasks(userId: string, filters: { range?: string; start?: string; end?: string }) {
  const range = filters.range || "today";
  const window = taskWindow(range, filters.start, filters.end);
  const todayWindow = taskWindow("today");
  const isLifetime = range === "lifetime";
  // Lifetime returns an empty date filter object — do not pass it as a Prisma date
  // filter (that matches nulls). Require non-null scheduled dates instead.
  const appointmentDateFilter = isLifetime ? { not: null } : Object.keys(window).length ? window : undefined;
  const followUpDateFilter = isLifetime ? { not: null } : Object.keys(window).length ? window : undefined;
  const reminderDateFilter = isLifetime ? undefined : Object.keys(window).length ? window : undefined;

  const [
    reminders,
    localAppointments,
    regAppointments,
    localFollowUps,
    regFollowUps,
    callsCompleted,
    quota,
    localOverdueCount,
    regOverdueCount,
    campaignMemberships
  ] = await Promise.all([
    prisma.reminder.findMany({
      where: { userId, ...(reminderDateFilter ? { dueAt: reminderDateFilter } : {}) },
      orderBy: { dueAt: "asc" }
    }),
    prisma.lead.findMany({
      where: {
        claimedById: userId,
        ...(appointmentDateFilter ? { appointmentDate: appointmentDateFilter } : { appointmentDate: { not: null } })
      },
      select: { id: true, fullName: true, appointmentDate: true, phase: true },
      orderBy: { appointmentDate: "asc" }
    }),
    prisma.registryLead.findMany({
      where: {
        claimedById: userId,
        ...(appointmentDateFilter ? { appointmentDate: appointmentDateFilter } : { appointmentDate: { not: null } })
      },
      select: { id: true, displayName: true, appointmentDate: true, phase: true },
      orderBy: { appointmentDate: "asc" }
    }),
    prisma.lead.findMany({
      where: {
        claimedById: userId,
        ...(followUpDateFilter ? { nextFollowUpAt: followUpDateFilter } : { nextFollowUpAt: { not: null } })
      },
      select: { id: true, fullName: true, nextFollowUpAt: true, phase: true },
      orderBy: { nextFollowUpAt: "asc" }
    }),
    prisma.registryLead.findMany({
      where: {
        claimedById: userId,
        ...(followUpDateFilter ? { nextFollowUpAt: followUpDateFilter } : { nextFollowUpAt: { not: null } })
      },
      select: { id: true, displayName: true, nextFollowUpAt: true, phase: true },
      orderBy: { nextFollowUpAt: "asc" }
    }),
    prisma.activityEvent.count({
      where: {
        actorId: userId,
        type: ActivityType.CALL_NOTE,
        ...(range === "today" ? { createdAt: todayWindow } : Object.keys(window).length ? { createdAt: window } : {})
      }
    }),
    prisma.quota.findUnique({ where: { salesUserId_date: { salesUserId: userId, date: parseBusinessDate() } } }),
    prisma.lead.count({
      where: {
        claimedById: userId,
        nextFollowUpAt: { lt: startOfBusinessDay() },
        phase: { notIn: [LeadPhase.CLOSED_WON, LeadPhase.CLOSED_LOST, LeadPhase.N_A] }
      }
    }),
    prisma.registryLead.count({
      where: {
        claimedById: userId,
        nextFollowUpAt: { lt: startOfBusinessDay() },
        phase: { notIn: [LeadPhase.CLOSED_WON, LeadPhase.CLOSED_LOST, LeadPhase.N_A] }
      }
    }),
    prisma.campaignMember.findMany({
      where: {
        userId,
        dailyContactGoal: { gt: 0 },
        campaign: { status: CampaignStatus.ACTIVE }
      },
      select: {
        dailyContactGoal: true,
        campaign: { select: { id: true, name: true, label: true } }
      }
    })
  ]);

  const appointments = [
    ...localAppointments,
    ...regAppointments.map((r) => ({
      id: r.id,
      fullName: r.displayName,
      appointmentDate: r.appointmentDate,
      phase: r.phase
    }))
  ];
  const followUps = [
    ...localFollowUps,
    ...regFollowUps.map((r) => ({
      id: r.id,
      fullName: r.displayName,
      nextFollowUpAt: r.nextFollowUpAt,
      phase: r.phase
    }))
  ];
  const overdueFollowUps = localOverdueCount + regOverdueCount;

  const campaignGoals = await Promise.all(
    campaignMemberships.map(async (member) => {
      const campaignLeadIds = await prisma.campaignLead.findMany({
        where: { campaignId: member.campaign.id, assignedToId: userId, leadId: { not: null } },
        select: { leadId: true }
      });
      const leadIds = campaignLeadIds.map((row) => row.leadId!).filter(Boolean);
      // Distinct leads touched today (call note or stage advance) counts toward the goal.
      const touchedLeadRows = leadIds.length
        ? await prisma.activityEvent.findMany({
            where: {
              actorId: userId,
              leadId: { in: leadIds },
              createdAt: todayWindow,
              OR: [
                { type: ActivityType.CALL_NOTE },
                {
                  type: ActivityType.PHASE_CHANGED,
                  toPhase: {
                    in: [
                      LeadPhase.CONTACTED,
                      LeadPhase.FOLLOW_UP,
                      LeadPhase.N_A,
                      LeadPhase.CLOSED_WON,
                      LeadPhase.CLOSED_LOST
                    ]
                  }
                }
              ]
            },
            distinct: ["leadId"],
            select: { leadId: true }
          })
        : [];
      return {
        campaignId: member.campaign.id,
        name: member.campaign.name,
        label: member.campaign.label,
        target: member.dailyContactGoal,
        completed: touchedLeadRows.length
      };
    })
  );

  const tasks = [
    ...reminders.map((reminder) => ({
      id: reminder.id,
      kind: "REMINDER" as const,
      label: reminder.label,
      note: reminder.note,
      dueAt: reminder.dueAt,
      completedAt: reminder.completedAt
    })),
    ...appointments
      .filter((lead) => lead.appointmentDate)
      .map((lead) => ({
        id: `appointment-${lead.id}`,
        kind: "APPOINTMENT" as const,
        label: lead.fullName,
        dueAt: lead.appointmentDate!,
        leadId: lead.id,
        phase: lead.phase
      })),
    ...followUps
      .filter((lead) => lead.nextFollowUpAt)
      .map((lead) => ({
        id: `follow-up-${lead.id}`,
        kind: "FOLLOW_UP" as const,
        label: lead.fullName,
        dueAt: lead.nextFollowUpAt!,
        leadId: lead.id,
        phase: lead.phase
      }))
  ].sort((a, b) => {
    const aTime = a.dueAt?.getTime?.() ?? 0;
    const bTime = b.dueAt?.getTime?.() ?? 0;
    return aTime - bTime;
  });
  return {
    tasks,
    campaignGoals,
    stats: {
      openTasks: tasks.filter((task) => task.kind !== "REMINDER" || !task.completedAt).length,
      callsCompleted,
      callsTarget: quota?.callsTarget || 0,
      appointments: appointments.length,
      followUps: followUps.length,
      reminders: reminders.filter((reminder) => !reminder.completedAt).length,
      overdueFollowUps,
      campaignContactTarget: campaignGoals.reduce((sum, g) => sum + g.target, 0),
      campaignContactCompleted: campaignGoals.reduce((sum, g) => sum + g.completed, 0)
    }
  };
}

export async function getSalesLead(leadId: string) {
  const { getVirtualOrPersistedLead } = await import("../leads/unifiedLeadService.js");
  const lead = await getVirtualOrPersistedLead(leadId);
  return lead ? maskUnclaimedContact(lead as Parameters<typeof maskUnclaimedContact>[0]) : null;
}
