import fs from "fs";
import csv from "csv-parser";
import { Parser } from "@json2csv/plainjs";
import { LeadPhase, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { parseDay, startOfDay, endOfDay } from "../utils/dates.js";

const quotaSchema = z.object({
  salesUserId: z.string(),
  date: z.string(),
  callsTarget: z.coerce.number().int().min(0),
  leadsTarget: z.coerce.number().int().min(0)
});

const phaseValues = Object.values(LeadPhase);

function normalizeHeader(row, names) {
  const found = Object.keys(row).find((key) => names.includes(key.trim().toLowerCase()));
  return found ? String(row[found] || "").trim() : "";
}

export async function adminSummary(req, res, next) {
  try {
    const [leads, salesUsers, won, lost, followUps] = await Promise.all([
      prisma.lead.count(),
      prisma.user.count({ where: { role: Role.SALES } }),
      prisma.lead.count({ where: { phase: LeadPhase.CLOSED_WON } }),
      prisma.lead.count({ where: { phase: LeadPhase.CLOSED_LOST } }),
      prisma.lead.count({ where: { phase: LeadPhase.FOLLOW_UP } })
    ]);

    res.json({ leads, salesUsers, won, lost, followUps });
  } catch (error) {
    next(error);
  }
}

export async function listSalesUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      where: { role: Role.SALES },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" }
    });
    res.json({ users });
  } catch (error) {
    next(error);
  }
}

export async function listLeads(req, res, next) {
  try {
    const leads = await prisma.lead.findMany({
      include: { assignedTo: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    res.json({ leads });
  } catch (error) {
    next(error);
  }
}

export async function uploadLeads(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: "CSV file is required" });

    const salesUsers = await prisma.user.findMany({ where: { role: Role.SALES }, select: { id: true } });
    const rows = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("data", (row) => rows.push(row))
        .on("end", resolve)
        .on("error", reject);
    });

    const leads = rows
      .map((row, index) => {
        const fullName = normalizeHeader(row, ["full name", "fullname", "name"]);
        const phoneNumber = normalizeHeader(row, ["phone number", "phone", "mobile"]);
        const email = normalizeHeader(row, ["email", "email address"]);
        const phase = normalizeHeader(row, ["phase", "status"]).toUpperCase().replace(/[-\s]/g, "_");
        const assignedToId = salesUsers.length ? salesUsers[index % salesUsers.length].id : null;

        if (!fullName || !phoneNumber || !email) return null;
        return {
          fullName,
          phoneNumber,
          email,
          assignedToId,
          phase: phaseValues.includes(phase) ? phase : LeadPhase.NEW
        };
      })
      .filter(Boolean);

    if (!leads.length) return res.status(400).json({ message: "No valid leads found. Required columns: Full Name, Phone Number, Email." });

    await prisma.lead.createMany({ data: leads });
    fs.unlink(req.file.path, () => {});
    res.status(201).json({ imported: leads.length });
  } catch (error) {
    next(error);
  }
}

export async function upsertQuota(req, res, next) {
  try {
    const data = quotaSchema.parse(req.body);
    const date = parseDay(data.date);

    const quota = await prisma.quota.upsert({
      where: { salesUserId_date: { salesUserId: data.salesUserId, date } },
      update: { callsTarget: data.callsTarget, leadsTarget: data.leadsTarget },
      create: { salesUserId: data.salesUserId, date, callsTarget: data.callsTarget, leadsTarget: data.leadsTarget },
      include: { salesUser: { select: { id: true, name: true, email: true } } }
    });

    res.json({ quota });
  } catch (error) {
    next(error);
  }
}

export async function listQuotas(req, res, next) {
  try {
    const date = parseDay(req.query.date);
    const quotas = await prisma.quota.findMany({
      where: { date },
      include: { salesUser: { select: { id: true, name: true, email: true } } },
      orderBy: { salesUser: { name: "asc" } }
    });
    res.json({ quotas });
  } catch (error) {
    next(error);
  }
}

export async function exportReport(req, res, next) {
  try {
    const from = req.query.from ? startOfDay(new Date(req.query.from)) : startOfDay(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const to = req.query.to ? endOfDay(new Date(req.query.to)) : endOfDay();

    const users = await prisma.user.findMany({
      where: { role: Role.SALES },
      include: {
        quotas: { where: { date: { gte: from, lte: to } } },
        notes: { where: { createdAt: { gte: from, lte: to } } },
        activities: { where: { createdAt: { gte: from, lte: to } } },
        assignedLeads: true
      },
      orderBy: { name: "asc" }
    });

    const rows = users.map((user) => ({
      agent: user.name,
      email: user.email,
      assignedLeads: user.assignedLeads.length,
      callNotes: user.notes.length,
      activities: user.activities.length,
      quotaDays: user.quotas.length,
      totalCallTarget: user.quotas.reduce((sum, quota) => sum + quota.callsTarget, 0),
      totalLeadTarget: user.quotas.reduce((sum, quota) => sum + quota.leadsTarget, 0)
    }));

    const parser = new Parser();
    const csvOutput = parser.parse(rows);
    res.header("Content-Type", "text/csv");
    res.attachment(`agent-performance-${Date.now()}.csv`);
    res.send(csvOutput);
  } catch (error) {
    next(error);
  }
}
