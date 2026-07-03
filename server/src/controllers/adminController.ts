import { Parser } from "@json2csv/plainjs";
import { LeadPhase } from "@prisma/client";
import type { RequestHandler } from "express";
import { z } from "zod";
import {
  assignAdminLead,
  createAdminLead,
  createAdminSalesUser,
  uploadAdminLeads,
  upsertAdminQuota
} from "../features/admin/adminCommands.js";
import {
  getAdminReportRows,
  getAdminSummary,
  listAdminActivity,
  listAdminLeads,
  listAdminQuotas,
  listAdminSalesUsers
} from "../features/admin/adminQueries.js";

const quotaSchema = z.object({
  salesUserId: z.string(),
  date: z.string(),
  callsTarget: z.coerce.number().int().min(0),
  leadsTarget: z.coerce.number().int().min(0)
});

const leadSchema = z.object({
  fullName: z.string().min(1),
  phoneNumber: z.string().min(1),
  email: z.string().optional().default(""),
  phase: z.nativeEnum(LeadPhase).optional().default(LeadPhase.NEW),
  assignedToId: z.string().nullable().optional(),
  appointmentDate: z.string().nullable().optional(),
  businessName: z.string().optional().default(""),
  licenceNumber: z.string().optional().default(""),
  businessRegion: z.string().optional().default(""),
  businessZone: z.string().optional().default(""),
  businessWoreda: z.string().optional().default(""),
  businessKebele: z.string().optional().default(""),
  houseNumber: z.string().optional().default(""),
  businessTelephone: z.string().optional().default("")
});

const assignSchema = z.object({
  salesUserId: z.string().nullable()
});

const salesUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8)
});

export const adminSummary: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await getAdminSummary());
  } catch (error) {
    next(error);
  }
};

export const listSalesUsers: RequestHandler = async (_req, res, next) => {
  try {
    const users = await listAdminSalesUsers();
    res.json({ users });
  } catch (error) {
    next(error);
  }
};

export const createSalesUser: RequestHandler = async (req, res, next) => {
  try {
    const input = salesUserSchema.parse(req.body);
    const result = await createAdminSalesUser(input);

    if (result.status === "duplicate") {
      return res.status(409).json({ message: "A user with this email already exists" });
    }

    res.status(201).json({ user: result.user });
  } catch (error) {
    next(error);
  }
};

export const listLeads: RequestHandler = async (req, res, next) => {
  try {
    const leads = await listAdminLeads({
      search: String(req.query.search || ""),
      phase: String(req.query.phase || ""),
      assignedToId: String(req.query.assignedToId || ""),
      createdById: String(req.query.createdById || "")
    });
    res.json({ leads });
  } catch (error) {
    next(error);
  }
};

export const listActivity: RequestHandler = async (req, res, next) => {
  try {
    const activities = await listAdminActivity(req.query.limit);
    res.json({ activities });
  } catch (error) {
    next(error);
  }
};

export const uploadLeads: RequestHandler = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "CSV or Excel file is required" });

    const result = await uploadAdminLeads({ file: req.file, userId: req.user.id });

    if (result.status === "empty") {
      const firstIssue = result.skippedRows[0];
      return res.status(400).json({
        message: firstIssue ? `No new valid leads found. First issue: row ${firstIssue.row} - ${firstIssue.reason}.` : "No new valid leads found.",
        imported: result.imported,
        skipped: result.skipped,
        skippedRows: result.skippedRows
      });
    }

    res.status(201).json({ imported: result.imported, skipped: result.skipped, skippedRows: result.skippedRows });
  } catch (error) {
    next(error);
  }
};

export const createLead: RequestHandler = async (req, res, next) => {
  try {
    const input = leadSchema.parse(req.body);
    const result = await createAdminLead({ input, userId: req.user.id });

    if (result.status === "duplicate") {
      return res.status(409).json({ message: "A lead with this phone or license already exists", duplicate: result.duplicate });
    }

    res.status(201).json({ lead: result.lead });
  } catch (error) {
    next(error);
  }
};

export const assignLead: RequestHandler = async (req, res, next) => {
  try {
    const input = assignSchema.parse(req.body);
    const lead = await assignAdminLead({ leadId: String(req.params.id), salesUserId: input.salesUserId, userId: req.user.id });
    res.json({ lead });
  } catch (error) {
    next(error);
  }
};

export const upsertQuota: RequestHandler = async (req, res, next) => {
  try {
    const input = quotaSchema.parse(req.body);
    const quota = await upsertAdminQuota(input);
    res.json({ quota });
  } catch (error) {
    next(error);
  }
};

export const listQuotas: RequestHandler = async (req, res, next) => {
  try {
    const quotas = await listAdminQuotas(req.query.date);
    res.json({ quotas });
  } catch (error) {
    next(error);
  }
};

export const exportReport: RequestHandler = async (req, res, next) => {
  try {
    const rows = await getAdminReportRows({ fromInput: req.query.from, toInput: req.query.to });
    const parser = new Parser();
    const csvOutput = parser.parse(rows);

    res.header("Content-Type", "text/csv");
    res.attachment(`agent-performance-${Date.now()}.csv`);
    res.send(csvOutput);
  } catch (error) {
    next(error);
  }
};
