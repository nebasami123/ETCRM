import { LeadPhase } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ensureSalesLeadAccess } from "../leads/leadService.js";
import { endOfDay, startOfDay } from "../../utils/dates.js";

export async function getSalesDashboard(userId: string) {
  const today = startOfDay();
  const tomorrow = endOfDay();

  const [quota, callsCompleted, processedLeadIds, todoLeads, phaseCounts] = await Promise.all([
    prisma.quota.findUnique({ where: { salesUserId_date: { salesUserId: userId, date: today } } }),
    prisma.callNote.count({ where: { agentId: userId, createdAt: { gte: today, lte: tomorrow } } }),
    prisma.activityLog.findMany({
      where: { userId, leadId: { not: null }, createdAt: { gte: today, lte: tomorrow } },
      distinct: ["leadId"],
      select: { leadId: true }
    }),
    prisma.lead.findMany({
      where: {
        OR: [
          { assignedToId: userId, followUpDate: { gte: today, lte: tomorrow } },
          { assignedToId: userId, appointmentDate: { gte: today, lte: tomorrow } },
          { assignedToId: userId, phase: LeadPhase.NEW },
          { createdById: userId, phase: LeadPhase.NEW },
          // Unassigned new leads appear here so sales users can claim them by contacting.
          { assignedToId: null, phase: LeadPhase.NEW }
        ]
      },
      orderBy: [{ appointmentDate: "asc" }, { followUpDate: "asc" }, { createdAt: "desc" }]
    }),
    prisma.lead.groupBy({
      by: ["phase"],
      where: { assignedToId: userId },
      _count: { phase: true }
    })
  ]);

  return {
    quota: quota || { callsTarget: 0, leadsTarget: 0, date: today },
    progress: { callsCompleted, leadsProcessed: processedLeadIds.length },
    todoLeads,
    phaseCounts
  };
}

export async function listSalesLeads(userId: string) {
  return prisma.lead.findMany({
    where: {
      OR: [
        { assignedToId: userId },
        { createdById: userId },
        { assignedToId: null, phase: LeadPhase.NEW }
      ]
    },
    orderBy: { updatedAt: "desc" }
  });
}

export async function getSalesLead(leadId: string, userId: string) {
  return ensureSalesLeadAccess(leadId, userId);
}
