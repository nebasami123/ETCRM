import { Parser } from "@json2csv/plainjs";
import { leadInputSchema, paginationSchema } from "@etcrm/contracts";
import { ClaimRequestStatus, LeadPhase } from "@prisma/client";
import type { RequestHandler } from "express";
import { z } from "zod";
import { fromNodeHeaders } from "better-auth/node";
import {
  assignAdminLead,
  bulkAssignAdminLeads,
  bulkPhaseAdminLeads,
  createAdminLead,
  createAdminSalesUser,
  resetAdminSalesPassword,
  uploadAdminLeads,
  upsertAdminQuota,
  updateAdminLead
} from "../features/admin/adminCommands.js";
import {
  countPendingTransfers,
  getAdminOverviewAggregates,
  getAdminReportRows,
  getAdminSummary,
  getLeaderboard as getLeaderboardQuery,
  listAdminActivity,
  listAdminLeads,
  listAdminQuotas,
  listAdminSalesUsers,
  listAllAdminUsers,
  listClaimTransferRequests
} from "../features/admin/adminQueries.js";
import { importEmptyMessage, resolveClaimTransfer, updateLeadPhase } from "../features/leads/leadWorkflowService.js";

const quotaSchema = z.object({
  salesUserId: z.string(),
  date: z.string(),
  callsTarget: z.coerce.number().int().min(0),
  leadsTarget: z.coerce.number().int().min(0)
});
const leadSchema = leadInputSchema;
const assignSchema = z.object({ salesUserId: z.string().nullable() });

function parseQueryStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))];
  }
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  // Support comma-separated values from simple clients
  return [...new Set(raw.split(",").map((item) => item.trim()).filter(Boolean))];
}
const salesUserSchema = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8) });
const passwordResetSchema = z.object({ newPassword: z.string().min(8).max(128) });
const phaseSchema = z
  .object({ phase: z.nativeEnum(LeadPhase), creditedUserId: z.string().nullable().optional() })
  .superRefine((value, context) => {
    if (value.phase === LeadPhase.CLOSED_WON && !value.creditedUserId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A credited salesperson is required when closing a lead as won",
        path: ["creditedUserId"]
      });
    }
  });
const transferResolutionSchema = z.object({ approve: z.boolean() });
const bulkAssignSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(200),
  salesUserId: z.string().nullable()
});
const bulkPhaseSchema = z
  .object({
    leadIds: z.array(z.string().min(1)).min(1).max(200),
    phase: z.nativeEnum(LeadPhase),
    creditedUserId: z.string().nullable().optional()
  })
  .superRefine((value, context) => {
    if (value.phase === LeadPhase.CLOSED_WON && !value.creditedUserId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A credited salesperson is required when closing leads as won",
        path: ["creditedUserId"]
      });
    }
  });

export const adminSummary: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await getAdminSummary());
  } catch (error) {
    next(error);
  }
};

export const adminOverviewAggregates: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await getAdminOverviewAggregates());
  } catch (error) {
    next(error);
  }
};

export const getLeaderboard: RequestHandler = async (_req, res, next) => {
  try {
    res.json({ leaderboard: await getLeaderboardQuery() });
  } catch (error) {
    next(error);
  }
};

export const listSalesUsers: RequestHandler = async (_req, res, next) => {
  try {
    res.json({ users: await listAdminSalesUsers() });
  } catch (error) {
    next(error);
  }
};

export const listAllUsers: RequestHandler = async (_req, res, next) => {
  try {
    res.json({ users: await listAllAdminUsers() });
  } catch (error) {
    next(error);
  }
};

export const createSalesUser: RequestHandler = async (req, res, next) => {
  try {
    const result = await createAdminSalesUser(salesUserSchema.parse(req.body));
    if (result.status === "duplicate") return res.status(409).json({ message: "A user with this email already exists" });
    res.status(201).json({ user: result.user });
  } catch (error) {
    next(error);
  }
};

export const resetSalesUserPassword: RequestHandler = async (req, res, next) => {
  try {
    const reset = await resetAdminSalesPassword({
      userId: String(req.params.id),
      newPassword: passwordResetSchema.parse(req.body).newPassword,
      headers: fromNodeHeaders(req.headers)
    });
    if (!reset) return res.status(404).json({ message: "Sales user not found" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const listLeads: RequestHandler = async (req, res, next) => {
  try {
    const pagination = paginationSchema.parse({ page: req.query.page, pageSize: req.query.pageSize });
    res.json(
      await listAdminLeads({
        search: String(req.query.search || ""),
        phase: String(req.query.phase || ""),
        claimedById: String(req.query.claimedById || ""),
        createdById: String(req.query.createdById || ""),
        region: String(req.query.region || ""),
        subcity: String(req.query.subcity || ""),
        sector: parseQueryStringArray(req.query.sector),
        source: String(req.query.source || ""),
        page: pagination.page,
        pageSize: pagination.pageSize
      })
    );
  } catch (error) {
    next(error);
  }
};

export const listRegistry: RequestHandler = async (req, res, next) => {
  try {
    const pagination = paginationSchema.parse({ page: req.query.page, pageSize: req.query.pageSize });
    const { listRegistryLeads } = await import("../features/registry/registryService.js");
    res.json(
      await listRegistryLeads({
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
      })
    );
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

export const claimRegistryLeadAdmin: RequestHandler = async (req, res, next) => {
  try {
    const body = z
      .object({
        mongoBusinessId: z.string().min(1),
        phoneKey: z.string().min(1).optional(),
        phoneNumber: z.string().min(1).optional(),
        claim: z.boolean().optional()
      })
      .refine((value) => value.phoneKey || value.phoneNumber, { message: "phoneKey or phoneNumber is required" })
      .parse(req.body);
    const { claimRegistryLead } = await import("../features/registry/registryService.js");
    const result = await claimRegistryLead({
      mongoBusinessId: body.mongoBusinessId,
      phoneKey: body.phoneKey,
      phoneNumber: body.phoneNumber,
      actorId: req.user.id,
      claimActor: body.claim === true
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

export const listActivity: RequestHandler = async (req, res, next) => {
  try {
    res.json(await listAdminActivity({ limit: req.query.limit, page: req.query.page }));
  } catch (error) {
    next(error);
  }
};

export const uploadLeads: RequestHandler = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "CSV or Excel file is required" });
    const result = await uploadAdminLeads({ file: req.file, userId: req.user.id });
    if (result.status === "empty") return res.status(400).json({ message: importEmptyMessage(result), ...result });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const createLead: RequestHandler = async (req, res, next) => {
  try {
    const result = await createAdminLead({ input: leadSchema.parse(req.body), userId: req.user.id });
    if (result.status === "duplicate") {
      return res.status(409).json({ message: "A lead with this phone number already exists", duplicate: result.duplicate });
    }
    res.status(201).json({ lead: result.lead });
  } catch (error) {
    next(error);
  }
};

export const updateLead: RequestHandler = async (req, res, next) => {
  try {
    const result = await updateAdminLead({
      leadId: String(req.params.id),
      input: leadSchema.parse(req.body),
      userId: req.user.id
    });
    if (result.status === "not-found") return res.status(404).json({ message: "Lead not found" });
    if (result.status === "duplicate") {
      return res.status(409).json({ message: "A lead with this phone number already exists", duplicate: result.duplicate });
    }
    if (result.status === "invalid") return res.status(400).json({ message: result.message });
    res.json({ lead: result.lead });
  } catch (error) {
    next(error);
  }
};

export const assignLead: RequestHandler = async (req, res, next) => {
  try {
    const lead = await assignAdminLead({
      leadId: String(req.params.id),
      salesUserId: assignSchema.parse(req.body).salesUserId,
      userId: req.user.id
    });
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.json({ lead });
  } catch (error) {
    next(error);
  }
};

export const bulkAssignLeads: RequestHandler = async (req, res, next) => {
  try {
    const input = bulkAssignSchema.parse(req.body);
    const result = await bulkAssignAdminLeads({
      leadIds: input.leadIds,
      salesUserId: input.salesUserId,
      userId: req.user.id
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const bulkUpdatePhases: RequestHandler = async (req, res, next) => {
  try {
    const input = bulkPhaseSchema.parse(req.body);
    const result = await bulkPhaseAdminLeads({
      leadIds: input.leadIds,
      phase: input.phase,
      creditedUserId: input.creditedUserId,
      userId: req.user.id
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const updateAdminLeadPhase: RequestHandler = async (req, res, next) => {
  try {
    const input = phaseSchema.parse(req.body);
    const result = await updateLeadPhase({
      leadId: String(req.params.id),
      actorId: req.user.id,
      phase: input.phase,
      creditedUserId: input.creditedUserId,
      requireOwnership: false
    });
    if (result.status === "not-found") return res.status(404).json({ message: "Lead not found" });
    if (result.status !== "ok") return res.status(403).json({ message: "Forbidden" });
    res.json({ lead: result.lead });
  } catch (error) {
    next(error);
  }
};

export const listTransferRequests: RequestHandler = async (req, res, next) => {
  try {
    const status = String(req.query.status || "PENDING");
    if (status !== "ALL" && !Object.values(ClaimRequestStatus).includes(status as ClaimRequestStatus)) {
      return res.status(400).json({ message: "Invalid claim-transfer status" });
    }
    res.json({ requests: await listClaimTransferRequests(status) });
  } catch (error) {
    next(error);
  }
};

export const pendingTransferCount: RequestHandler = async (_req, res, next) => {
  try {
    res.json({ count: await countPendingTransfers() });
  } catch (error) {
    next(error);
  }
};

export const resolveTransferRequest: RequestHandler = async (req, res, next) => {
  try {
    const lead = await resolveClaimTransfer({
      requestId: String(req.params.id),
      adminId: req.user.id,
      approve: transferResolutionSchema.parse(req.body).approve
    });
    if (!lead) return res.status(404).json({ message: "Pending transfer request not found" });
    res.json({ lead });
  } catch (error) {
    next(error);
  }
};

export const upsertQuota: RequestHandler = async (req, res, next) => {
  try {
    res.json({ quota: await upsertAdminQuota(quotaSchema.parse(req.body)) });
  } catch (error) {
    next(error);
  }
};

export const listQuotas: RequestHandler = async (req, res, next) => {
  try {
    res.json({ quotas: await listAdminQuotas(req.query.date) });
  } catch (error) {
    next(error);
  }
};

export const exportReport: RequestHandler = async (req, res, next) => {
  try {
    const csvOutput = new Parser().parse(await getAdminReportRows({ fromInput: req.query.from, toInput: req.query.to }));
    res.header("Content-Type", "text/csv");
    res.attachment(`agent-performance-${Date.now()}.csv`);
    res.send(csvOutput);
  } catch (error) {
    next(error);
  }
};

export const getPerformanceMetrics: RequestHandler = async (req, res, next) => {
  try {
    const metrics = await getAdminReportRows({ fromInput: req.query.from, toInput: req.query.to });
    res.json({ metrics });
  } catch (error) {
    next(error);
  }
};

const campaignFiltersSchema = z.object({
  region: z.string().optional(),
  subcity: z.string().optional(),
  sector: z.union([z.string(), z.array(z.string())]).optional(),
  nationality: z.string().optional(),
  businessType: z.string().optional(),
  capitalMin: z.coerce.number().optional(),
  capitalMax: z.coerce.number().optional(),
  scoreMin: z.coerce.number().optional(),
  scoreMax: z.coerce.number().optional()
});

const campaignAllocationSchema = z.object({
  userId: z.string().min(1),
  count: z.coerce.number().int().min(0).max(100_000),
  dailyContactGoal: z.coerce.number().int().min(0).max(100_000).optional()
});

const createCampaignSchema = z.object({
  name: z.string().trim().min(2).max(120),
  label: z.string().trim().max(40).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  filters: campaignFiltersSchema.optional(),
  sortMode: z.enum(["capital_desc", "capital_asc", "value_desc", "value_asc", "random"]).optional(),
  durationDays: z.coerce.number().int().min(1).max(365).optional(),
  allocations: z.array(campaignAllocationSchema).max(50).optional()
});

const launchCampaignSchema = z.object({
  filters: campaignFiltersSchema.optional(),
  sortMode: z.enum(["capital_desc", "capital_asc", "value_desc", "value_asc", "random"]).optional(),
  allocations: z.array(campaignAllocationSchema).min(1).max(50)
});

const updateCampaignSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  label: z.string().trim().max(40).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "CLOSED"]).optional()
});

const previewCampaignSchema = z.object({
  filters: campaignFiltersSchema.optional(),
  sortMode: z.enum(["capital_desc", "capital_asc", "value_desc", "value_asc", "random"]).optional(),
  requested: z.coerce.number().int().min(1).max(100_000).optional()
});

export const listCampaigns: RequestHandler = async (req, res, next) => {
  try {
    const { listCampaigns: list } = await import("../features/campaigns/campaignQueries.js");
    res.json({ campaigns: await list({ status: String(req.query.status || "") }) });
  } catch (error) {
    next(error);
  }
};

export const getCampaign: RequestHandler = async (req, res, next) => {
  try {
    const { getCampaignDetail } = await import("../features/campaigns/campaignQueries.js");
    const campaign = await getCampaignDetail(String(req.params.id));
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    res.json({ campaign });
  } catch (error) {
    next(error);
  }
};

export const createCampaign: RequestHandler = async (req, res, next) => {
  try {
    const body = createCampaignSchema.parse(req.body);
    const { createCampaign: create } = await import("../features/campaigns/campaignCommands.js");
    const result = await create({ ...body, adminId: req.user.id });
    if (result.status === "invalid") return res.status(400).json({ message: result.message });
    res.status(201).json({ campaign: result.campaign });
  } catch (error) {
    next(error);
  }
};

export const updateCampaign: RequestHandler = async (req, res, next) => {
  try {
    const body = updateCampaignSchema.parse(req.body);
    const { updateCampaignMeta } = await import("../features/campaigns/campaignCommands.js");
    const result = await updateCampaignMeta({ campaignId: String(req.params.id), ...body });
    if (result.status === "not-found") return res.status(404).json({ message: "Campaign not found" });
    if (result.status === "invalid") return res.status(400).json({ message: result.message });
    res.json({ campaign: result.campaign });
  } catch (error) {
    next(error);
  }
};

export const previewCampaign: RequestHandler = async (req, res, next) => {
  try {
    const body = previewCampaignSchema.parse(req.body);
    const { previewCampaignPool } = await import("../features/campaigns/campaignQueries.js");
    res.json(
      await previewCampaignPool({
        filters: body.filters || {},
        sortMode: body.sortMode || "capital_desc",
        requested: body.requested || 50
      })
    );
  } catch (error) {
    next(error);
  }
};

const preparePoolSchema = z.object({
  filters: campaignFiltersSchema.optional(),
  sortMode: z.enum(["capital_desc", "capital_asc", "value_desc", "value_asc", "random"]).optional(),
  poolSize: z.coerce.number().int().min(1).max(500)
});

export const prepareCampaignPool: RequestHandler = async (req, res, next) => {
  try {
    const body = preparePoolSchema.parse(req.body);
    const { prepareCampaignPool: prepare } = await import("../features/campaigns/campaignCommands.js");
    const result = await prepare({
      campaignId: String(req.params.id),
      filters: body.filters,
      sortMode: body.sortMode,
      poolSize: body.poolSize
    });
    if (result.status === "not-found") return res.status(404).json({ message: "Campaign not found" });
    if (result.status === "invalid") return res.status(400).json({ message: result.message });
    if (result.status === "empty") return res.status(409).json({ message: result.message });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const launchCampaign: RequestHandler = async (req, res, next) => {
  try {
    const body = launchCampaignSchema.parse(req.body);
    const { launchCampaign: launch } = await import("../features/campaigns/campaignCommands.js");
    const result = await launch({
      campaignId: String(req.params.id),
      adminId: req.user.id,
      filters: body.filters,
      sortMode: body.sortMode,
      allocations: body.allocations
    });
    if (result.status === "not-found") return res.status(404).json({ message: "Campaign not found" });
    if (result.status === "invalid") return res.status(400).json({ message: result.message });
    if (result.status === "empty") {
      return res.status(409).json({ message: result.message, results: "results" in result ? result.results : undefined });
    }
    res.json({
      campaign: result.campaign,
      results: result.results,
      message: "message" in result ? result.message : undefined
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCampaign: RequestHandler = async (req, res, next) => {
  try {
    const { deleteDraftCampaign } = await import("../features/campaigns/campaignCommands.js");
    const result = await deleteDraftCampaign(String(req.params.id));
    if (result.status === "not-found") return res.status(404).json({ message: "Campaign not found" });
    if (result.status === "invalid") return res.status(400).json({ message: result.message });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const campaignFilterOptions: RequestHandler = async (_req, res, next) => {
  try {
    const { getCampaignFilterOptions } = await import("../features/campaigns/campaignQueries.js");
    res.json(await getCampaignFilterOptions());
  } catch (error) {
    next(error);
  }
};

export const campaignAnalytics: RequestHandler = async (_req, res, next) => {
  try {
    const { getCampaignAnalytics } = await import("../features/campaigns/campaignQueries.js");
    res.json({ campaigns: await getCampaignAnalytics() });
  } catch (error) {
    next(error);
  }
};
