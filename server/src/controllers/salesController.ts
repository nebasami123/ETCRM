import { LeadPhase } from "@prisma/client";
import type { RequestHandler } from "express";
import { z } from "zod";
import {
  addSalesCallNote,
  createSalesLead,
  updateSalesAppointment,
  updateSalesLeadPhase,
  uploadSalesLeads
} from "../features/sales/salesCommands.js";
import { getSalesDashboard, getSalesLead, listSalesLeads } from "../features/sales/salesQueries.js";

const phaseSchema = z.object({ phase: z.nativeEnum(LeadPhase) });
const noteSchema = z.object({ note: z.string().min(2) });
const appointmentSchema = z.object({
  appointmentDate: z.string().nullable().optional()
});
const leadSchema = z.object({
  fullName: z.string().min(1),
  phoneNumber: z.string().min(1),
  email: z.string().optional().default(""),
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

export const dashboard: RequestHandler = async (req, res, next) => {
  try {
    res.json(await getSalesDashboard(req.user.id));
  } catch (error) {
    next(error);
  }
};

export const listMyLeads: RequestHandler = async (req, res, next) => {
  try {
    const leads = await listSalesLeads(req.user.id);
    res.json({ leads });
  } catch (error) {
    next(error);
  }
};

export const getLead: RequestHandler = async (req, res, next) => {
  try {
    const lead = await getSalesLead(String(req.params.id), req.user.id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.json({ lead });
  } catch (error) {
    next(error);
  }
};

export const updateLeadPhase: RequestHandler = async (req, res, next) => {
  try {
    const data = phaseSchema.parse(req.body);
    const lead = await updateSalesLeadPhase({ leadId: String(req.params.id), userId: req.user.id, phase: data.phase });
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.json({ lead });
  } catch (error) {
    next(error);
  }
};

export const addCallNote: RequestHandler = async (req, res, next) => {
  try {
    const data = noteSchema.parse(req.body);
    const note = await addSalesCallNote({ leadId: String(req.params.id), userId: req.user.id, note: data.note });
    if (!note) return res.status(404).json({ message: "Lead not found" });
    res.status(201).json({ note });
  } catch (error) {
    next(error);
  }
};

export const updateAppointment: RequestHandler = async (req, res, next) => {
  try {
    const data = appointmentSchema.parse(req.body);
    const result = await updateSalesAppointment({ leadId: String(req.params.id), userId: req.user.id, appointmentDate: data.appointmentDate });

    if (result.status === "not-found") return res.status(404).json({ message: "Lead not found" });
    if (result.status === "invalid-date") return res.status(400).json({ message: "Invalid appointment date" });

    res.json({ lead: result.lead });
  } catch (error) {
    next(error);
  }
};

export const createLead: RequestHandler = async (req, res, next) => {
  try {
    const input = leadSchema.parse(req.body);
    const result = await createSalesLead({ input, userId: req.user.id });

    if (result.status === "duplicate") {
      return res.status(409).json({ message: "A lead with this phone or license already exists", duplicate: result.duplicate });
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
