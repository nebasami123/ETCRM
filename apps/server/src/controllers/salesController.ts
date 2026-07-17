import { LeadPhase } from "@prisma/client";
import { leadInputSchema, paginationSchema } from "@etcrm/contracts";
import type { RequestHandler } from "express";
import { z } from "zod";
import {
  addSalesCallNote,
  claimSalesLead,
  createSalesLead,
  requestSalesClaimTransfer,
  updateSalesAppointment,
  updateSalesFollowUp,
  updateSalesLeadPhase,
  uploadSalesLeads
} from "../features/sales/salesCommands.js";
import { importEmptyMessage } from "../features/leads/leadWorkflowService.js";
import {
  getSalesDashboard,
  getSalesLeaderboard as getSalesLeaderboardQuery,
  getSalesLead,
  getSalesTasks,
  listSalesLeads
} from "../features/sales/salesQueries.js";
import { completeReminder, createReminder } from "../features/sales/reminderCommands.js";

const phaseSchema = z.object({ phase: z.nativeEnum(LeadPhase) });
const noteSchema = z.object({ note: z.string().trim().min(2).max(5000) });
const appointmentSchema = z.object({ appointmentDate: z.string().nullable().optional() });
const followUpSchema = z.object({ nextFollowUpAt: z.string().nullable().optional() });
const transferSchema = z.object({ reason: z.string().trim().min(3).max(1000) });
const leadSchema = leadInputSchema;

function parseQueryStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))];
  }
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  return [...new Set(raw.split(",").map((item) => item.trim()).filter(Boolean))];
}
const reminderSchema = z.object({
  label: z.string().trim().min(2).max(120),
  note: z.string().trim().max(1000).optional(),
  dueAt: z.string().datetime()
});
const reminderCompletionSchema = z.object({ complete: z.boolean() });

function ownershipDenied(res: import("express").Response, claimedById?: string | null) {
  return res.status(403).json({
    message: "Only the claim owner can update this lead. Request a transfer if you need ownership.",
    claimedById: claimedById ?? null
  });
}

export const dashboard: RequestHandler = async (req, res, next) => {
  try {
    res.json(await getSalesDashboard(req.user.id));
  } catch (error) {
    next(error);
  }
};

export const getLeaderboard: RequestHandler = async (req, res, next) => {
  try {
    res.json(await getSalesLeaderboardQuery(req.user.id));
  } catch (error) {
    next(error);
  }
};

export const listMyLeads: RequestHandler = async (req, res, next) => {
  try {
    const pagination = paginationSchema.parse({ page: req.query.page, pageSize: req.query.pageSize });
    res.json(
      await listSalesLeads(req.user.id, {
        search: String(req.query.search || ""),
        phase: String(req.query.phase || ""),
        scope: String(req.query.scope || "all"),
        region: String(req.query.region || ""),
        subcity: String(req.query.subcity || ""),
        sector: parseQueryStringArray(req.query.sector),
        source: String(req.query.source || ""),
        campaignId: String(req.query.campaignId || ""),
        page: pagination.page,
        pageSize: pagination.pageSize
      })
    );
  } catch (error) {
    next(error);
  }
};

export const listMyCampaigns: RequestHandler = async (req, res, next) => {
  try {
    const { listSalesCampaigns } = await import("../features/campaigns/campaignQueries.js");
    res.json({ campaigns: await listSalesCampaigns(req.user.id) });
  } catch (error) {
    next(error);
  }
};

export const listRegistry: RequestHandler = async (req, res, next) => {
  try {
    const pagination = paginationSchema.parse({ page: req.query.page, pageSize: req.query.pageSize });
    const { listRegistryLeads } = await import("../features/registry/registryService.js");
    const result = await listRegistryLeads({
      search: String(req.query.search || ""),
      region: String(req.query.region || ""),
      subcity: String(req.query.subcity || ""),
      sector: parseQueryStringArray(req.query.sector),
      nationality: String(req.query.nationality || ""),
      businessType: String(req.query.businessType || ""),
      capitalMin: req.query.capitalMin ? Number(req.query.capitalMin) : undefined,
      capitalMax: req.query.capitalMax ? Number(req.query.capitalMax) : undefined,
      scoreMin: req.query.scoreMin ? Number(req.query.scoreMin) : undefined,
      scoreMax: req.query.scoreMax ? Number(req.query.scoreMax) : undefined,
      page: pagination.page,
      pageSize: pagination.pageSize
    });
    res.json({
      ...result,
      leads: result.leads.map((lead) => {
        // Keep phoneKey for claim; mask display numbers until the lead is in CRM and claimed.
        if (lead.inCrm && lead.claimedById) return { ...lead, contactMasked: false };
        return {
          ...lead,
          phoneNumber: "+251 91 000 0000",
          managerPhone: "+251 91 000 0000",
          businessNumber: lead.businessNumber ? "+251 91 000 0000" : "",
          contactMasked: true
        };
      })
    });
  } catch (error) {
    next(error);
  }
};

export const registryFilterOptions: RequestHandler = async (_req, res, next) => {
  try {
    const { getRegistryFilterOptions } = await import("../features/registry/registryService.js");
    res.json(await getRegistryFilterOptions());
  } catch (error) {
    next(error);
  }
};

export const localLeadFilterOptions: RequestHandler = async (_req, res, next) => {
  try {
    const { listLocalLeadFilterOptions } = await import("../features/registry/registryService.js");
    res.json(await listLocalLeadFilterOptions());
  } catch (error) {
    next(error);
  }
};

export const claimRegistry: RequestHandler = async (req, res, next) => {
  try {
    const body = z
      .object({
        mongoBusinessId: z.string().min(1),
        phoneKey: z.string().min(1).optional(),
        phoneNumber: z.string().min(1).optional()
      })
      .refine((value) => value.phoneKey || value.phoneNumber, { message: "phoneKey or phoneNumber is required" })
      .parse(req.body);
    const { claimRegistryLead } = await import("../features/registry/registryService.js");
    const result = await claimRegistryLead({
      mongoBusinessId: body.mongoBusinessId,
      phoneKey: body.phoneKey,
      phoneNumber: body.phoneNumber,
      actorId: req.user.id,
      claimActor: true
    });
    if (result.status === "not-found") return res.status(404).json({ message: "Business not found in registry" });
    if (result.status === "invalid-phone") return res.status(400).json({ message: "Phone number must contain digits" });
    if (result.status === "phone-not-on-business") {
      return res.status(400).json({ message: "That phone number is not on this business" });
    }
    if (result.status === "duplicate") {
      return res.status(409).json({ message: "A lead with this phone number already exists", duplicate: result.duplicate });
    }
    res.status(201).json({ lead: result.lead });
  } catch (error) {
    next(error);
  }
};

export const getTasks: RequestHandler = async (req, res, next) => {
  try {
    res.json(
      await getSalesTasks(req.user.id, {
        range: String(req.query.range || "today"),
        start: typeof req.query.start === "string" ? req.query.start : undefined,
        end: typeof req.query.end === "string" ? req.query.end : undefined
      })
    );
  } catch (error) {
    next(error);
  }
};

export const addReminder: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json({ reminder: await createReminder({ userId: req.user.id, ...reminderSchema.parse(req.body) }) });
  } catch (error) {
    next(error);
  }
};

export const setReminderComplete: RequestHandler = async (req, res, next) => {
  try {
    const updated = await completeReminder({
      userId: req.user.id,
      reminderId: String(req.params.id),
      complete: reminderCompletionSchema.parse(req.body).complete
    });
    if (!updated) return res.status(404).json({ message: "Reminder not found" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const getLead: RequestHandler = async (req, res, next) => {
  try {
    const lead = await getSalesLead(String(req.params.id));
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.json({ lead });
  } catch (error) {
    next(error);
  }
};

export const updateLeadPhase: RequestHandler = async (req, res, next) => {
  try {
    const phase = phaseSchema.parse(req.body).phase;
    const result = await updateSalesLeadPhase({ leadId: String(req.params.id), userId: req.user.id, phase });
    if (result.status === "closed-won-forbidden") {
      return res.status(403).json({ message: "An admin must close a lead as won and select conversion credit" });
    }
    if (result.status === "not-found") return res.status(404).json({ message: "Lead not found" });
    if (result.status === "forbidden") return ownershipDenied(res, result.claimedById);
    res.json({ lead: result.lead });
  } catch (error) {
    next(error);
  }
};

export const addCallNote: RequestHandler = async (req, res, next) => {
  try {
    const result = await addSalesCallNote({
      leadId: String(req.params.id),
      userId: req.user.id,
      note: noteSchema.parse(req.body).note
    });
    if (result.status === "not-found") return res.status(404).json({ message: "Lead not found" });
    if (result.status === "forbidden") return ownershipDenied(res, result.claimedById);
    res.status(201).json({ lead: result.lead });
  } catch (error) {
    next(error);
  }
};

export const updateAppointment: RequestHandler = async (req, res, next) => {
  try {
    const result = await updateSalesAppointment({
      leadId: String(req.params.id),
      userId: req.user.id,
      appointmentDate: appointmentSchema.parse(req.body).appointmentDate
    });
    if (result.status === "not-found") return res.status(404).json({ message: "Lead not found" });
    if (result.status === "forbidden") return ownershipDenied(res, result.claimedById);
    res.json({ lead: result.lead });
  } catch (error) {
    next(error);
  }
};

export const updateFollowUp: RequestHandler = async (req, res, next) => {
  try {
    const result = await updateSalesFollowUp({
      leadId: String(req.params.id),
      userId: req.user.id,
      followUpDate: followUpSchema.parse(req.body).nextFollowUpAt
    });
    if (result.status === "not-found") return res.status(404).json({ message: "Lead not found" });
    if (result.status === "forbidden") return ownershipDenied(res, result.claimedById);
    res.json({ lead: result.lead });
  } catch (error) {
    next(error);
  }
};

export const claimLead: RequestHandler = async (req, res, next) => {
  try {
    const result = await claimSalesLead({ leadId: String(req.params.id), userId: req.user.id });
    if (result.status === "not-found") return res.status(404).json({ message: "Lead not found" });
    if (result.status === "already-claimed") {
      return res.status(409).json({ message: "This lead has already been claimed", claimedById: result.claimedById });
    }
    res.json({ lead: result.lead });
  } catch (error) {
    next(error);
  }
};

export const requestTransfer: RequestHandler = async (req, res, next) => {
  try {
    const result = await requestSalesClaimTransfer({
      leadId: String(req.params.id),
      userId: req.user.id,
      reason: transferSchema.parse(req.body).reason
    });
    if (result.status === "not-found") return res.status(404).json({ message: "Lead not found" });
    if (result.status === "unclaimed" || result.status === "already-claimer") {
      return res.status(409).json({
        message: result.status === "unclaimed" ? "Claim the lead directly instead" : "You already claim this lead"
      });
    }
    if (result.status === "pending-exists") {
      return res.status(409).json({ message: "A pending transfer request already exists for this lead", requestId: result.requestId });
    }
    res.status(201).json({ request: result.request });
  } catch (error) {
    next(error);
  }
};

export const createLead: RequestHandler = async (req, res, next) => {
  try {
    const result = await createSalesLead({ input: leadSchema.parse(req.body), userId: req.user.id });
    if (result.status === "duplicate") {
      return res.status(409).json({ message: "A lead with this phone number already exists", duplicate: result.duplicate });
    }
    res.status(201).json({ lead: result.lead });
  } catch (error) {
    next(error);
  }
};

export const uploadLeads: RequestHandler = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "CSV or Excel file is required" });
    const result = await uploadSalesLeads({ file: req.file, userId: req.user.id });
    if (result.status === "empty") return res.status(400).json({ message: importEmptyMessage(result), ...result });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};
