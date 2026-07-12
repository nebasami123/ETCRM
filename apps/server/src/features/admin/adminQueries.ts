import { ActivityType, LeadPhase, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { businessDate, endOfBusinessDay, parseBusinessDate, startOfBusinessDay } from "../../utils/dates.js";
import { leadDetailInclude } from "../leads/leadService.js";

const salesOnly = { role: "SALES" };

export async function getAdminSummary() {
  const today = startOfBusinessDay();
  const [leads, salesUsers, won, lost, followUps, unclaimed, salesCreatedToday] = await Promise.all([
    prisma.lead.count(),
    prisma.user.count({ where: salesOnly }),
    prisma.lead.count({ where: { phase: LeadPhase.CLOSED_WON } }),
    prisma.lead.count({ where: { phase: LeadPhase.CLOSED_LOST } }),
    prisma.lead.count({ where: { phase: LeadPhase.FOLLOW_UP } }),
    prisma.lead.count({ where: { claimedById: null } }),
    prisma.lead.count({ where: { createdAt: { gte: today }, createdBy: salesOnly } })
  ]);
  return { leads, salesUsers, won, lost, followUps, unclaimed, salesCreatedToday };
}

export async function listAdminSalesUsers() {
  return prisma.user.findMany({ where: salesOnly, select: { id: true, name: true, email: true, role: true }, orderBy: { name: "asc" } });
}

export async function listAdminLeads(filters: { search?: string; phase?: string; claimedById?: string; createdById?: string; page?: number; pageSize?: number }) {
  const search = filters.search?.trim();
  const phase = filters.phase?.trim();
  const claimedById = filters.claimedById?.trim();
  const where: Prisma.LeadWhereInput = {
    ...(phase && phase !== "ALL" && Object.values(LeadPhase).includes(phase as LeadPhase) ? { phase: phase as LeadPhase } : {}),
    ...(claimedById === "UNCLAIMED" ? { claimedById: null } : claimedById ? { claimedById } : {}),
    ...(filters.createdById ? { createdById: filters.createdById } : {}),
    ...(search ? { OR: ["fullName", "phoneNumber", "email", "businessName", "licenceNumber", "businessRegion", "businessWoreda"].map((field) => ({ [field]: { contains: search, mode: "insensitive" } })) } : {})
  };
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 50));
  const [leads, total] = await prisma.$transaction([
    prisma.lead.findMany({ where, include: leadDetailInclude, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.lead.count({ where })
  ]);
  return { leads, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function listAdminActivity(input: { limit?: unknown; page?: unknown }) {
  const limit = Math.min(100, Math.max(1, Number(input.limit || 30)));
  const page = Math.max(1, Number(input.page || 1));
  const [activities, total] = await prisma.$transaction([
    prisma.activityEvent.findMany({ include: { actor: { select: { id: true, name: true, email: true, role: true } }, creditedUser: { select: { id: true, name: true } }, lead: { select: { id: true, fullName: true, phoneNumber: true, phase: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.activityEvent.count()
  ]);
  return { activities, pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function listAdminQuotas(dateInput: unknown) {
  return prisma.quota.findMany({ where: { date: parseBusinessDate(dateInput) }, include: { salesUser: { select: { id: true, name: true, email: true } } }, orderBy: { salesUser: { name: "asc" } } });
}

export async function listClaimTransferRequests(status = "PENDING") {
  return prisma.claimTransferRequest.findMany({
    where: status === "ALL" ? {} : { status: status as Prisma.EnumClaimRequestStatusFilter["equals"] },
    include: { lead: { select: { id: true, fullName: true, phoneNumber: true, claimedBy: { select: { id: true, name: true } } } }, requestedBy: { select: { id: true, name: true, email: true } }, resolvedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100
  });
}

export async function getAdminReportRows({ fromInput, toInput }: { fromInput: unknown; toInput: unknown }) {
  const from = fromInput ? startOfBusinessDay(new Date(String(fromInput))) : startOfBusinessDay(new Date(Date.now() - 6 * 86_400_000));
  const to = toInput ? endOfBusinessDay(new Date(String(toInput))) : endOfBusinessDay();
  const users = await prisma.user.findMany({
    where: salesOnly,
    include: {
      quotas: { where: { date: { gte: parseBusinessDate(businessDate(from)), lte: parseBusinessDate(businessDate(to)) } } },
      events: { where: { createdAt: { gte: from, lte: to } } },
      claimedLeads: { select: { id: true } },
      createdLeads: { where: { createdAt: { gte: from, lte: to } }, select: { id: true } },
      conversionCredits: { where: { type: ActivityType.PHASE_CHANGED, toPhase: LeadPhase.CLOSED_WON, createdAt: { gte: from, lte: to } }, select: { id: true } }
    }, orderBy: { name: "asc" }
  });
  return users.map((user) => ({ agent: user.name, email: user.email, claimedLeads: user.claimedLeads.length, createdLeads: user.createdLeads.length, callNotes: user.events.filter((item) => item.type === ActivityType.CALL_NOTE).length, activities: user.events.length, conversionsCredited: user.conversionCredits.length, quotaDays: user.quotas.length, totalCallTarget: user.quotas.reduce((sum, quota) => sum + quota.callsTarget, 0), totalLeadTarget: user.quotas.reduce((sum, quota) => sum + quota.leadsTarget, 0) }));
}
