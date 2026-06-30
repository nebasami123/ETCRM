import { LeadPhase, Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { endOfDay, parseDay, startOfDay } from "../../utils/dates.js";

export async function getAdminSummary() {
  const today = startOfDay();
  const [leads, salesUsers, won, lost, followUps, unassigned, salesCreatedToday] = await Promise.all([
    prisma.lead.count(),
    prisma.user.count({ where: { role: Role.SALES } }),
    prisma.lead.count({ where: { phase: LeadPhase.CLOSED_WON } }),
    prisma.lead.count({ where: { phase: LeadPhase.CLOSED_LOST } }),
    prisma.lead.count({ where: { phase: LeadPhase.FOLLOW_UP } }),
    prisma.lead.count({ where: { assignedToId: null } }),
    prisma.lead.count({
      where: {
        createdAt: { gte: today },
        createdBy: { role: Role.SALES }
      }
    })
  ]);

  return { leads, salesUsers, won, lost, followUps, unassigned, salesCreatedToday };
}

export async function listAdminSalesUsers() {
  return prisma.user.findMany({
    where: { role: Role.SALES },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" }
  });
}

export async function listAdminLeads(filters: { search?: string; phase?: string; assignedToId?: string; createdById?: string }) {
  const search = String(filters.search || "").trim();
  const phase = String(filters.phase || "").trim();
  const assignedToId = String(filters.assignedToId || "").trim();
  const createdById = String(filters.createdById || "").trim();

  const where: Prisma.LeadWhereInput = {
    ...(phase && phase !== "ALL" ? { phase: phase as LeadPhase } : {}),
    ...(assignedToId === "UNASSIGNED" ? { assignedToId: null } : assignedToId ? { assignedToId } : {}),
    ...(createdById ? { createdById } : {}),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search } },
            { phoneNumber: { contains: search } },
            { email: { contains: search } },
            { businessName: { contains: search } },
            { licenceNumber: { contains: search } },
            { businessRegion: { contains: search } },
            { businessWoreda: { contains: search } }
          ]
        }
      : {})
  };

  return prisma.lead.findMany({
    where,
    include: {
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, role: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });
}

export async function listAdminActivity(limitInput: unknown) {
  const limit = Math.min(Number(limitInput || 30), 100);
  return prisma.activityLog.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      lead: { select: { id: true, fullName: true, phoneNumber: true, phase: true } }
    },
    orderBy: { createdAt: "desc" },
    take: limit
  });
}

export async function listAdminQuotas(dateInput: unknown) {
  const date = parseDay(dateInput);
  return prisma.quota.findMany({
    where: { date },
    include: { salesUser: { select: { id: true, name: true, email: true } } },
    orderBy: { salesUser: { name: "asc" } }
  });
}

export async function getAdminReportRows({ fromInput, toInput }: { fromInput: unknown; toInput: unknown }) {
  const from = fromInput ? startOfDay(new Date(String(fromInput))) : startOfDay(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const to = toInput ? endOfDay(new Date(String(toInput))) : endOfDay();

  const users = await prisma.user.findMany({
    where: { role: Role.SALES },
    include: {
      quotas: { where: { date: { gte: from, lte: to } } },
      notes: { where: { createdAt: { gte: from, lte: to } } },
      activities: { where: { createdAt: { gte: from, lte: to } } },
      assignedLeads: true,
      createdLeads: { where: { createdAt: { gte: from, lte: to } } }
    },
    orderBy: { name: "asc" }
  });

  return users.map((user) => ({
    agent: user.name,
    email: user.email,
    assignedLeads: user.assignedLeads.length,
    createdLeads: user.createdLeads.length,
    callNotes: user.notes.length,
    activities: user.activities.length,
    quotaDays: user.quotas.length,
    totalCallTarget: user.quotas.reduce((sum, quota) => sum + quota.callsTarget, 0),
    totalLeadTarget: user.quotas.reduce((sum, quota) => sum + quota.leadsTarget, 0)
  }));
}
