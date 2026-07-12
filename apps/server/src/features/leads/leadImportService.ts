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

export function field(row: LeadImportRow, names: string[]) {
  const keys = names.map(normalizedHeader);
  const found = Object.keys(row).find((key) => keys.includes(normalizedHeader(key)));
  return found ? String(row[found] || "").trim() : "";
}

export async function readLeadRows(file: Express.Multer.File): Promise<LeadImportRow[]> {
  const extension = file.originalname.toLowerCase().split(".").pop() || "";
  if (["xlsx", "xls"].includes(extension)) {
    const workbook = XLSX.readFile(file.path, { cellDates: true });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<LeadImportRow>(firstSheet, { defval: "" });
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
  const phoneNumber = field(row, ["phone number", "phone", "mobile", "manager phone", "business number", "Business Telephone"]);
  if (!fullName || !phoneNumber) return null;
  const licenceNumber = field(row, ["LicenceNumber", "License Number", "TIN"]);
  const phaseRaw = field(row, ["phase", "status"]).toUpperCase().replace(/[-\s]/g, "_");

  return {
    fullName,
    phoneNumber,
    phoneKey: phoneKey(phoneNumber),
    email: field(row, ["email", "email address"]),
    phase: Object.values(LeadPhase).includes(phaseRaw as LeadPhase) ? (phaseRaw as LeadPhase) : LeadPhase.NEW,
    createdById: ownership.createdById || null,
    appointmentDate: parseOptionalDate(field(row, ["appointment date", "appointmentdate", "appointment"])),
    nextFollowUpAt: parseOptionalDate(field(row, ["follow up", "followup", "next follow up"])),
    dateRegistered: parseOptionalDate(field(row, ["DateRegistered", "Date Registered"])),
    legalStatusNameEng: field(row, ["LegalStatusNameEng", "Business Type"]) || null,
    legalStatusNameAmh: field(row, ["LegalStatusNameAmh"]) || null,
    status: field(row, ["Status"]) || null,
    licenceNumber: licenceNumber || null,
    licenceKey: licenceKey(licenceNumber),
    renewedTo: parseOptionalDate(field(row, ["RenewedTo", "Renewed To"])),
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
  const licenceKeys = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate.lead) {
      skipped.push({ row: candidate.rowNumber, reason: "Missing business/name or phone" });
      continue;
    }
    const duplicateInFile = phoneKeys.has(candidate.lead.phoneKey) || Boolean(candidate.lead.licenceKey && licenceKeys.has(candidate.lead.licenceKey));
    if (duplicateInFile) {
      skipped.push({ row: candidate.rowNumber, reason: "Duplicate inside uploaded file", lead: candidate.lead.fullName });
      continue;
    }
    phoneKeys.add(candidate.lead.phoneKey);
    if (candidate.lead.licenceKey) licenceKeys.add(candidate.lead.licenceKey);
    valid.push(candidate as LeadImportCandidate & { lead: Prisma.LeadCreateManyInput });
  }

  const existing = valid.length
    ? await client.lead.findMany({
        where: { OR: [{ phoneKey: { in: [...phoneKeys] } }, ...(licenceKeys.size ? [{ licenceKey: { in: [...licenceKeys] } }] : [])] },
        select: { phoneKey: true, licenceKey: true }
      })
    : [];
  const existingPhones = new Set(existing.map((lead) => lead.phoneKey));
  const existingLicences = new Set(existing.map((lead) => lead.licenceKey).filter(Boolean));
  const leads = valid.flatMap((candidate) => {
    const lead = candidate.lead;
    if (existingPhones.has(lead.phoneKey) || Boolean(lead.licenceKey && existingLicences.has(lead.licenceKey))) {
      skipped.push({ row: candidate.rowNumber, reason: "Already exists in CRM", lead: lead.fullName });
      return [];
    }
    return [lead];
  });

  return { leads, skipped };
}
