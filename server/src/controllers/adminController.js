import fs from "fs";
import csv from "csv-parser";
import XLSX from "xlsx";
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

function normalizeExact(row, name) {
  return normalizeHeader(row, [name.toLowerCase()]);
}

function parseOptionalDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function readRows(file) {
  const extension = file.originalname.toLowerCase().split(".").pop();
  if (["xlsx", "xls"].includes(extension)) {
    const workbook = XLSX.readFile(file.path, { cellDates: true });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
  }

  const rows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(file.path)
      .pipe(csv())
      .on("data", (row) => rows.push(row))
      .on("end", resolve)
      .on("error", reject);
  });
  return rows;
}

function buildLead(row, assignedToId) {
  const managerName = [normalizeExact(row, "ManagerFName"), normalizeExact(row, "ManagerMName"), normalizeExact(row, "ManagerLName")].filter(Boolean).join(" ");
  const businessName = normalizeExact(row, "BusinessName");
  const fullName = normalizeHeader(row, ["full name", "fullname", "name"]) || businessName || managerName;
  const phoneNumber = normalizeHeader(row, ["phone number", "phone", "mobile", "mangerphone", "managerphone"]) || normalizeExact(row, "BussinessTelephone");
  const email = normalizeHeader(row, ["email", "email address"]);
  const phase = normalizeHeader(row, ["phase", "status"]).toUpperCase().replace(/[-\s]/g, "_");

  if (!fullName || !phoneNumber) return null;

  return {
    fullName,
    phoneNumber,
    email,
    assignedToId,
    phase: phaseValues.includes(phase) ? phase : LeadPhase.NEW,
    appointmentDate: parseOptionalDate(normalizeHeader(row, ["appointment date", "appointmentdate", "appointment"])),
    dateRegistered: parseOptionalDate(normalizeExact(row, "DateRegistered")),
    legalStatusNameEng: normalizeExact(row, "LegalStatusNameEng"),
    legalStatusNameAmh: normalizeExact(row, "LegalStatusNameAmh"),
    status: normalizeExact(row, "Status"),
    licenceNumber: normalizeExact(row, "LicenceNumber"),
    renewedTo: parseOptionalDate(normalizeExact(row, "RenewedTo")),
    siteId: normalizeExact(row, "SiteID"),
    businessName,
    businessNameAmharic: normalizeExact(row, "BusinessNameAmharic"),
    managerFName: normalizeExact(row, "ManagerFName"),
    managerMName: normalizeExact(row, "ManagerMName"),
    managerLName: normalizeExact(row, "ManagerLName"),
    description: normalizeExact(row, "description"),
    code: normalizeExact(row, "Code"),
    englishDescription: normalizeExact(row, "EnglishDescription"),
    amDescription: normalizeExact(row, "Amdiscrption"),
    subGroup: normalizeExact(row, "SubGroup"),
    subGroupAm: normalizeExact(row, "SubGroupAM"),
    subGroupEn: normalizeExact(row, "SubGroupEN"),
    businessRegion: normalizeExact(row, "BussinessdescriptionRegion"),
    businessZone: normalizeExact(row, "BussinessDescriptionZones"),
    businessWoreda: normalizeExact(row, "BussinessDescriptionWoredas"),
    businessKebele: normalizeExact(row, "BussinessAmharickebeles"),
    houseNumber: normalizeExact(row, "HousNum"),
    businessTelephone: normalizeExact(row, "BussinessTelephone")
  };
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
    if (!req.file) return res.status(400).json({ message: "CSV or Excel file is required" });

    const salesUsers = await prisma.user.findMany({ where: { role: Role.SALES }, select: { id: true } });
    const rows = await readRows(req.file);

    const leads = rows
      .map((row, index) => {
        const assignedToId = salesUsers.length ? salesUsers[index % salesUsers.length].id : null;
        return buildLead(row, assignedToId);
      })
      .filter(Boolean);

    if (!leads.length) return res.status(400).json({ message: "No valid leads found. Required fields: business/name and phone." });

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
