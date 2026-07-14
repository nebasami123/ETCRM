import fs from "node:fs";
import { unlink } from "node:fs/promises";
import csv from "csv-parser";
import XLSX from "xlsx";
import { LeadPhase, Prisma } from "@prisma/client";
import { env } from "../../config/env.js";
import { licenceKey, phoneKey } from "./leadService.js";
import { parseOptionalDate } from "../../utils/dates.js";

export type LeadImportRow = Record<string, unknown>;
type DbClient = Prisma.TransactionClient | import("@prisma/client").PrismaClient;

export interface LeadImportCandidate {
  rowNumber: number;
  lead: Prisma.LeadCreateManyInput | null;
}

export interface SkippedLeadRow {
  row: number;
  reason: string;
  lead?: string;
}

export async function removeUpload(file?: Express.Multer.File) {
  if (file?.path) await unlink(file.path).catch(() => undefined);
}

function normalizedHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeImportedPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  // Excel removes a leading zero from numeric Ethiopian landline/mobile values.
  return digits.length === 9 && /^[19]/.test(digits) ? `0${digits}` : value;
}

function normalizeImportedTin(value: string) {
  // The reference export uses 10-digit TINs. Preserve this format when Excel
  // has converted a zero-padded identifier into a number.
  return /^\d{1,10}$/.test(value) ? value.padStart(10, "0") : value;
}

function parseImportedDate(value: string) {
  if (!value) return null;
  const serial = Number(value);
  if (/^\d+(\.\d+)?$/.test(value) && serial >= 1 && serial <= 100_000) {
    return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
  }
  return parseOptionalDate(value);
}

export function field(row: LeadImportRow, names: string[]) {
  const keys = names.map(normalizedHeader);
  const found = Object.keys(row).find((key) => keys.includes(normalizedHeader(key)) && String(row[key] ?? "").trim());
  return found ? String(row[found] || "").trim() : "";
}

export async function readLeadRows(file: Express.Multer.File): Promise<LeadImportRow[]> {
  const extension = file.originalname.toLowerCase().split(".").pop() || "";
  if (["xlsx", "xls"].includes(extension)) {
    const workbook = XLSX.readFile(file.path, { cellDates: true });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    // Use displayed values so Excel-formatted identifiers (for example, zero-padded TINs)
    // stay intact before the common CSV/XLSX lead mapper processes them.
    const rows = XLSX.utils.sheet_to_json<LeadImportRow>(firstSheet, { defval: "", raw: false, dateNF: "yyyy-mm-dd" });
    if (rows.length > env.UPLOAD_MAX_ROWS) throw new Error(`Uploads are limited to ${env.UPLOAD_MAX_ROWS} rows`);
    return rows;
  }

  const rows: LeadImportRow[] = [];
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(file.path)
      .pipe(csv())
      .on("data", (row: LeadImportRow) => {
        if (rows.length < env.UPLOAD_MAX_ROWS + 1) rows.push(row);
      })
      .on("end", resolve)
      .on("error", reject);
  });
  if (rows.length > env.UPLOAD_MAX_ROWS) throw new Error(`Uploads are limited to ${env.UPLOAD_MAX_ROWS} rows`);
  return rows;
}

export function buildLead(row: LeadImportRow, ownership: { createdById?: string | null } = {}): Prisma.LeadCreateManyInput | null {
  const businessName = field(row, ["BusinessName", "Business Name"]);
  const managerFName = field(row, ["ManagerFName", "Manager First Name"]);
  const managerMName = field(row, ["ManagerMName", "Manager Middle Name"]);
  const managerLName = field(row, ["ManagerLName", "Manager Last Name"]);
  const managerName = [managerFName, managerMName, managerLName].filter(Boolean).join(" ");
  const fullName = field(row, ["full name", "fullname", "name", "contact name"]) || businessName || managerName;
  const phoneNumber = normalizeImportedPhone(field(row, ["phone number", "phone", "mobile", "mobile number", "manager phone", "manager phone number", "manager mobile", "manager telephone", "business number", "Business Telephone", "telephone", "tel"]));
  if (!fullName || !phoneNumber) return null;
  const licenceNumber = normalizeImportedTin(field(row, ["LicenceNumber", "License Number", "TIN"]));
  return {
    fullName,
    phoneNumber,
    phoneKey: phoneKey(phoneNumber),
    email: field(row, ["email", "email address"]),
    // Imports always enter the queue as new leads, irrespective of source-system status values.
    phase: LeadPhase.NEW,
    createdById: ownership.createdById || null,
    appointmentDate: parseImportedDate(field(row, ["appointment date", "appointmentdate", "appointment"])),
    nextFollowUpAt: parseImportedDate(field(row, ["follow up", "followup", "next follow up"])),
    dateRegistered: parseImportedDate(field(row, ["DateRegistered", "Date Registered"])),
    legalStatusNameEng: field(row, ["LegalStatusNameEng", "Business Type"]) || null,
    legalStatusNameAmh: field(row, ["LegalStatusNameAmh"]) || null,
    status: field(row, ["Status"]) || null,
    licenceNumber: licenceNumber || null,
    licenceKey: licenceKey(licenceNumber),
    renewedTo: parseImportedDate(field(row, ["RenewedTo", "Renewed To"])),
    siteId: field(row, ["SiteID"]) || null,
    businessName: businessName || null,
    businessNameAmharic: field(row, ["BusinessNameAmharic"]) || null,
    managerFName: managerFName || null,
    managerMName: managerMName || null,
    managerLName: managerLName || null,
    description: field(row, ["description"]) || null,
    code: field(row, ["Code", "Sector"]) || null,
    englishDescription: field(row, ["EnglishDescription", "Sector Category"]) || null,
    amDescription: field(row, ["Amdiscrption"]) || null,
    subGroup: field(row, ["SubGroup"]) || null,
    subGroupAm: field(row, ["SubGroupAM"]) || null,
    subGroupEn: field(row, ["SubGroupEN"]) || null,
    businessRegion: field(row, ["Business Region", "Region"]) || null,
    businessZone: field(row, ["Business Zones", "Zone"]) || null,
    businessWoreda: field(row, ["Business Woreda", "Subcity", "Woreda"]) || null,
    businessKebele: field(row, ["Business Kebele", "Kebele"]) || null,
    houseNumber: field(row, ["HousNum", "House Number"]) || null,
    businessTelephone: field(row, ["Business Telephone", "Business Number"]) || null
  };
}

export async function prepareLeadImport(client: DbClient, candidates: LeadImportCandidate[]) {
  const skipped: SkippedLeadRow[] = [];
  const valid: Array<LeadImportCandidate & { lead: Prisma.LeadCreateManyInput }> = [];
  const phoneKeys = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate.lead) {
      skipped.push({ row: candidate.rowNumber, reason: "Missing business/name or phone" });
      continue;
    }
    const duplicateInFile = phoneKeys.has(candidate.lead.phoneKey);
    if (duplicateInFile) {
      skipped.push({ row: candidate.rowNumber, reason: "Duplicate inside uploaded file", lead: candidate.lead.fullName });
      continue;
    }
    phoneKeys.add(candidate.lead.phoneKey);
    valid.push(candidate as LeadImportCandidate & { lead: Prisma.LeadCreateManyInput });
  }

  const existing = valid.length
    ? await client.lead.findMany({
        where: { phoneKey: { in: [...phoneKeys] } },
        select: { phoneKey: true }
      })
    : [];
  const existingPhones = new Set(existing.map((lead) => lead.phoneKey));
  const leads = valid.flatMap((candidate) => {
    const lead = candidate.lead;
    if (existingPhones.has(lead.phoneKey)) {
      skipped.push({ row: candidate.rowNumber, reason: "Already exists in CRM", lead: lead.fullName });
      return [];
    }
    return [lead];
  });

  return { leads, skipped };
}
