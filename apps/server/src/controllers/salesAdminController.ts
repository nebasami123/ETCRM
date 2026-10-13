import type { RequestHandler } from "express";
import { z } from "zod";
import { salesPipelineStages } from "../features/leads/pipelineStage.js";
import {
  assignSalesAdminLead,
  createSalesAdminRep,
  getSalesAdminDashboard,
  listSalesAdminActivity,
  listSalesAdminLeads,
  listSalesAdminQuotas,
  listSalesAdminTeam,
  resetSalesAdminPassword,
  saveSalesAdminQuota,
  setSalesAdminRepStatus,
  updateSalesAdminRepType
} from "../features/salesAdmin/salesAdminService.js";

const teamCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  salesType: z.enum(["INTERNAL", "EXTERNAL"]).default("INTERNAL")
});
const passwordSchema = z.object({ newPassword: z.string().min(8).max(128) });
const statusSchema = z.object({ active: z.boolean() });
const typeSchema = z.object({ salesType: z.enum(["INTERNAL", "EXTERNAL"]) });
const quotaSchema = z.object({
  salesUserId: z.string().min(1),
  date: z.string().min(1),
  callsTarget: z.coerce.number().int().min(0),
  leadsTarget: z.coerce.number().int().min(0)
});

export const salesAdminDashboard: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await getSalesAdminDashboard());
  } catch (error) {
    next(error);
  }
};
export const salesAdminTeam: RequestHandler = async (_req, res, next) => {
  try {
    res.json({ users: await listSalesAdminTeam() });
  } catch (error) {
    next(error);
  }
};
export const salesAdminCreateRep: RequestHandler = async (req, res, next) => {
  try {
    const result = await createSalesAdminRep(teamCreateSchema.parse(req.body));
    if (result.status === "duplicate") {
      return res.status(409).json({ message: "A user with this email already exists" });
    }
    res.status(201).json({ message: "Sales account created" });
  } catch (error) {
    next(error);
  }
};
export const salesAdminResetPassword: RequestHandler = async (req, res, next) => {
  try {
    const found = await resetSalesAdminPassword(String(req.params.id), passwordSchema.parse(req.body).newPassword);
    if (!found) return res.status(404).json({ message: "Sales user not found" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
export const salesAdminSetStatus: RequestHandler = async (req, res, next) => {
  try {
    const result = await setSalesAdminRepStatus(String(req.params.id), statusSchema.parse(req.body).active, req.user.id);
    if (result === "not-found") return res.status(404).json({ message: "Sales user not found" });
    if (result === "forbidden") return res.status(403).json({ message: "You cannot deactivate your own account" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
export const salesAdminSetType: RequestHandler = async (req, res, next) => {
  try {
    const updated = await updateSalesAdminRepType(String(req.params.id), typeSchema.parse(req.body).salesType);
    if (!updated) return res.status(404).json({ message: "Sales user not found" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
export const salesAdminLeads: RequestHandler = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));
    const pipelineStage = req.query.stage ? z.enum(salesPipelineStages).parse(String(req.query.stage)) : undefined;
    res.json(await listSalesAdminLeads({ search: String(req.query.search || ""), pipelineStage, page, pageSize }));
  } catch (error) {
    next(error);
  }
};
export const salesAdminAssignLead: RequestHandler = async (req, res, next) => {
  try {
    const { salesUserId } = z.object({ salesUserId: z.string().nullable() }).parse(req.body);
    const result = await assignSalesAdminLead(String(req.params.id), salesUserId, req.user.id);
    if (result === "not-found") return res.status(404).json({ message: "Sales-owned lead not found" });
    if (result === "invalid-target") return res.status(400).json({ message: "Choose an active sales representative" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
export const salesAdminActivity: RequestHandler = async (req, res, next) => {
  try {
    res.json(await listSalesAdminActivity({
      page: Math.max(1, Number(req.query.page || 1)),
      limit: Math.min(100, Math.max(1, Number(req.query.limit || 30)))
    }));
  } catch (error) {
    next(error);
  }
};
export const salesAdminQuotas: RequestHandler = async (req, res, next) => {
  try {
    res.json({ quotas: await listSalesAdminQuotas(String(req.query.date || new Date().toISOString().slice(0, 10))) });
  } catch (error) {
    next(error);
  }
};
export const salesAdminSaveQuota: RequestHandler = async (req, res, next) => {
  try {
    const quota = await saveSalesAdminQuota(quotaSchema.parse(req.body));
    if (!quota) return res.status(404).json({ message: "Active sales user not found" });
    res.json({ quota });
  } catch (error) {
    next(error);
  }
};
