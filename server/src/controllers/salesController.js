import { ActivityType, LeadPhase } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { endOfDay, startOfDay } from "../utils/dates.js";

const phaseSchema = z.object({ phase: z.nativeEnum(LeadPhase) });
const noteSchema = z.object({ note: z.string().min(2) });

async function ensureAssignedLead(leadId, userId) {
  return prisma.lead.findFirst({
    where: { id: leadId, assignedToId: userId },
    include: {
      assignedTo: { select: { id: true, name: true } },
      callNotes: {
        include: { agent: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" }
      }
    }
  });
}

export async function dashboard(req, res, next) {
  try {
    const today = startOfDay();
    const tomorrow = endOfDay();
    const userId = req.user.id;

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
          assignedToId: userId,
          OR: [{ followUpDate: { gte: today, lte: tomorrow } }, { phase: LeadPhase.NEW }]
        },
        orderBy: [{ followUpDate: "asc" }, { createdAt: "desc" }]
      }),
      prisma.lead.groupBy({
        by: ["phase"],
        where: { assignedToId: userId },
        _count: { phase: true }
      })
    ]);

    res.json({
      quota: quota || { callsTarget: 0, leadsTarget: 0, date: today },
      progress: { callsCompleted, leadsProcessed: processedLeadIds.length },
      todoLeads,
      phaseCounts
    });
  } catch (error) {
    next(error);
  }
}

export async function listMyLeads(req, res, next) {
  try {
    const leads = await prisma.lead.findMany({
      where: { assignedToId: req.user.id },
      orderBy: { updatedAt: "desc" }
    });
    res.json({ leads });
  } catch (error) {
    next(error);
  }
}

export async function getLead(req, res, next) {
  try {
    const lead = await ensureAssignedLead(req.params.id, req.user.id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.json({ lead });
  } catch (error) {
    next(error);
  }
}

export async function updateLeadPhase(req, res, next) {
  try {
    const lead = await ensureAssignedLead(req.params.id, req.user.id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const data = phaseSchema.parse(req.body);
    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: { phase: data.phase },
      include: {
        assignedTo: { select: { id: true, name: true } },
        callNotes: { include: { agent: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } }
      }
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        leadId: lead.id,
        type: ActivityType.PHASE_CHANGE,
        metadata: JSON.stringify({ from: lead.phase, to: data.phase })
      }
    });

    res.json({ lead: updated });
  } catch (error) {
    next(error);
  }
}

export async function addCallNote(req, res, next) {
  try {
    const lead = await ensureAssignedLead(req.params.id, req.user.id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const data = noteSchema.parse(req.body);
    const note = await prisma.callNote.create({
      data: { leadId: lead.id, agentId: req.user.id, note: data.note },
      include: { agent: { select: { id: true, name: true } } }
    });

    await prisma.activityLog.create({
      data: { userId: req.user.id, leadId: lead.id, type: ActivityType.CALL_NOTE }
    });

    res.status(201).json({ note });
  } catch (error) {
    next(error);
  }
}
