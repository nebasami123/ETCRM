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
        page: pagination.page,
        pageSize: pagination.pageSize
      })
    );
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
