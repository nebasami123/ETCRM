import { ActivityType, LeadPhase, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { endOfBusinessDay, parseBusinessDate, startOfBusinessDay } from "../../utils/dates.js";
import { leadDetailInclude } from "../leads/leadService.js";

export async function getSalesDashboard(userId: string) {
  const today = startOfBusinessDay();
  const endToday = endOfBusinessDay();
  const [quota, callsCompleted, processedLeads, todoLeads, phaseCounts] = await Promise.all([
    prisma.quota.findUnique({ where: { salesUserId_date: { salesUserId: userId, date: parseBusinessDate() } } }),
    prisma.activityEvent.count({ where: { actorId: userId, type: ActivityType.CALL_NOTE, createdAt: { gte: today, lte: endToday } } }),
    prisma.activityEvent.findMany({ where: { actorId: userId, leadId: { not: null }, createdAt: { gte: today, lte: endToday } }, distinct: ["leadId"], select: { leadId: true } }),
    prisma.lead.findMany({ where: { claimedById: userId, OR: [{ nextFollowUpAt: { gte: today, lte: endToday } }, { appointmentDate: { gte: today, lte: endToday } }, { phase: LeadPhase.NEW }] }, include: leadDetailInclude, orderBy: [{ appointmentDate: "asc" }, { nextFollowUpAt: "asc" }, { createdAt: "desc" }], take: 100 }),
    prisma.lead.groupBy({ by: ["phase"], where: { claimedById: userId }, _count: { phase: true } })
  ]);
  return { quota: quota || { callsTarget: 0, leadsTarget: 0, date: parseBusinessDate() }, progress: { callsCompleted, leadsProcessed: processedLeads.length }, todoLeads, phaseCounts };
}

export async function listSalesLeads(filters: { search?: string; phase?: string; page?: number; pageSize?: number }) {
  const search = filters.search?.trim();
  const phase = filters.phase?.trim();
  const where: Prisma.LeadWhereInput = {
    ...(phase && phase !== "ALL" && Object.values(LeadPhase).includes(phase as LeadPhase) ? { phase: phase as LeadPhase } : {}),
    ...(search ? { OR: ["fullName", "phoneNumber", "email", "businessName", "licenceNumber"].map((field) => ({ [field]: { contains: search, mode: "insensitive" } })) } : {})
  };
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 50));
  const [leads, total] = await prisma.$transaction([prisma.lead.findMany({ where, include: leadDetailInclude, orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }), prisma.lead.count({ where })]);
  return { leads, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function getSalesLead(leadId: string) {
  return prisma.lead.findUnique({ where: { id: leadId }, include: leadDetailInclude });
}
