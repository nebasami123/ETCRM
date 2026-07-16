import { ActivityType, LeadPhase, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { endOfBusinessDay, parseBusinessDate, startOfBusinessDay, taskWindow } from "../../utils/dates.js";
import { leadDetailInclude } from "../leads/leadService.js";

const UNCLAIMED_PHONE_PLACEHOLDER = "+251 91 000 0000";
const UNCLAIMED_EMAIL_PLACEHOLDER = "lead@ethiopia.example";

/**
 * Sales users may browse unclaimed leads, but their actual contact details are
 * only returned after somebody claims the lead. Keeping this at the API
 * boundary prevents the real values from being exposed in browser tools.
 */
function maskUnclaimedContact<T extends { claimedById: string | null; phoneNumber: string; email: string | null }>(lead: T) {
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
  const [quota, callsCompleted, processedLeads, todoLeads, phaseCounts, reminders, overdueFollowUps] = await Promise.all([
    prisma.quota.findUnique({ where: { salesUserId_date: { salesUserId: userId, date: parseBusinessDate() } } }),
    prisma.activityEvent.count({ where: { actorId: userId, type: ActivityType.CALL_NOTE, createdAt: { gte: today, lte: endToday } } }),
    prisma.activityEvent.findMany({
      where: { actorId: userId, leadId: { not: null }, createdAt: { gte: today, lte: endToday } },
      distinct: ["leadId"],
      select: { leadId: true }
    }),
    prisma.lead.findMany({
      where: {
        claimedById: userId,
        OR: [{ nextFollowUpAt: { gte: today, lte: endToday } }, { appointmentDate: { gte: today, lte: endToday } }, { phase: LeadPhase.NEW }]
      },
      include: leadDetailInclude,
      orderBy: [{ appointmentDate: "asc" }, { nextFollowUpAt: "asc" }, { createdAt: "desc" }],
      take: 100
    }),
    prisma.lead.groupBy({ by: ["phase"], where: { claimedById: userId }, _count: { phase: true } }),
    prisma.reminder.findMany({
      where: { userId, completedAt: null, dueAt: { gte: today, lte: endToday } },
      orderBy: { dueAt: "asc" },
      take: 5
    }),
    prisma.lead.findMany({
      where: {
        claimedById: userId,
        nextFollowUpAt: { lt: today },
        phase: { notIn: [LeadPhase.CLOSED_WON, LeadPhase.CLOSED_LOST] }
      },
      select: { id: true, fullName: true, nextFollowUpAt: true, phase: true },
      orderBy: { nextFollowUpAt: "asc" },
      take: 20
    })
  ]);
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
  filters: { search?: string; phase?: string; scope?: string; page?: number; pageSize?: number }
) {
  const search = filters.search?.trim();
  const phase = filters.phase?.trim();
  const where: Prisma.LeadWhereInput = {
    ...(filters.scope === "mine" ? { claimedById: userId } : {}),
    ...(phase && phase !== "ALL" && Object.values(LeadPhase).includes(phase as LeadPhase) ? { phase: phase as LeadPhase } : {}),
    ...(search
      ? {
          OR: ["fullName", "phoneNumber", "email", "businessName", "licenceNumber"].map((field) => ({
            [field]: { contains: search, mode: "insensitive" }
          }))
        }
      : {})
  };
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 50));
  const [leads, total] = await prisma.$transaction([
    prisma.lead.findMany({
      where,
      include: leadDetailInclude,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.lead.count({ where })
  ]);
  return {
    leads: leads.map(maskUnclaimedContact),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
  };
}

export async function getSalesTasks(userId: string, filters: { range?: string; start?: string; end?: string }) {
  const range = filters.range || "today";
  const window = taskWindow(range, filters.start, filters.end);
  const todayWindow = taskWindow("today");
  const [reminders, appointments, followUps, callsCompleted, quota, overdueFollowUps] = await Promise.all([
    prisma.reminder.findMany({ where: { userId, dueAt: window }, orderBy: { dueAt: "asc" } }),
    prisma.lead.findMany({
      where: { claimedById: userId, appointmentDate: window },
      select: { id: true, fullName: true, appointmentDate: true, phase: true },
      orderBy: { appointmentDate: "asc" }
    }),
    prisma.lead.findMany({
      where: { claimedById: userId, nextFollowUpAt: window },
      select: { id: true, fullName: true, nextFollowUpAt: true, phase: true },
      orderBy: { nextFollowUpAt: "asc" }
    }),
    prisma.activityEvent.count({
      where: {
        actorId: userId,
        type: ActivityType.CALL_NOTE,
        ...(range === "today" ? { createdAt: todayWindow } : {})
      }
    }),
    prisma.quota.findUnique({ where: { salesUserId_date: { salesUserId: userId, date: parseBusinessDate() } } }),
    prisma.lead.count({
      where: {
        claimedById: userId,
        nextFollowUpAt: { lt: startOfBusinessDay() },
        phase: { notIn: [LeadPhase.CLOSED_WON, LeadPhase.CLOSED_LOST] }
      }
    })
  ]);
  const tasks = [
    ...reminders.map((reminder) => ({
      id: reminder.id,
      kind: "REMINDER" as const,
      label: reminder.label,
      note: reminder.note,
      dueAt: reminder.dueAt,
      completedAt: reminder.completedAt
    })),
    ...appointments.map((lead) => ({
      id: `appointment-${lead.id}`,
      kind: "APPOINTMENT" as const,
      label: lead.fullName,
      dueAt: lead.appointmentDate!,
      leadId: lead.id,
      phase: lead.phase
    })),
    ...followUps.map((lead) => ({
      id: `follow-up-${lead.id}`,
      kind: "FOLLOW_UP" as const,
      label: lead.fullName,
      dueAt: lead.nextFollowUpAt!,
      leadId: lead.id,
      phase: lead.phase
    }))
  ].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  return {
    tasks,
    stats: {
      openTasks: tasks.filter((task) => task.kind !== "REMINDER" || !task.completedAt).length,
      callsCompleted,
      callsTarget: quota?.callsTarget || 0,
      appointments: appointments.length,
      followUps: followUps.length,
      reminders: reminders.filter((reminder) => !reminder.completedAt).length,
      overdueFollowUps
    }
  };
}

export async function getSalesLead(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: leadDetailInclude });
  return lead ? maskUnclaimedContact(lead) : null;
}
