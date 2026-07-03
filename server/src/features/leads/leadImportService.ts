import fs from "fs";
import csv from "csv-parser";
import XLSX from "xlsx";
import { LeadPhase, Prisma, PrismaClient } from "@prisma/client";
import { parseOptionalDate } from "./leadService.js";

const phaseValues = Object.values(LeadPhase);

export type LeadImportRow = Record<string, unknown>;

interface BuildLeadOptions {
  assignedToId?: string | null;
  createdById?: string | null;
}

export interface LeadImportCandidate {
  rowNumber: number;
  lead: Prisma.LeadCreateManyInput | null;
}

interface SkippedLeadRow {
  row: number;
  reason: string;
  lead?: string;
}

export function normalizeHeader(row: LeadImportRow, names: string[]) {
  const normalizedNames = names.map(normalizeHeaderKey);
  const found = Object.keys(row).find((key) => normalizedNames.includes(normalizeHeaderKey(key)));
  return found ? String(row[found] || "").trim() : "";
}

function normalizeHeaderKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeExact(row: LeadImportRow, name: string) {
  return normalizeHeader(row, [name.toLowerCase()]);
}

export async function readLeadRows(file: Express.Multer.File): Promise<LeadImportRow[]> {
  const extension = file.originalname.toLowerCase().split(".").pop() || "";
  if (["xlsx", "xls"].includes(extension)) {
    const workbook = XLSX.readFile(file.path, { cellDates: true });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json<LeadImportRow>(firstSheet, { defval: "" });
  }

  const rows: LeadImportRow[] = [];
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(file.path)
      .pipe(csv())
      .on("data", (row: LeadImportRow) => rows.push(row))
      .on("end", () => resolve())
      .on("error", reject);
  });
  return rows;
}

export function buildLead(row: LeadImportRow, { assignedToId = null, createdById = null }: BuildLeadOptions = {}): Prisma.LeadCreateManyInput | null {
  const managerFName = normalizeHeader(row, ["ManagerFName", "Manager First Name", "manager first"]);
  const managerMName = normalizeHeader(row, ["ManagerMName", "Manager Middle Name", "manager middle"]);
  const managerLName = normalizeHeader(row, ["ManagerLName", "Manager Last Name", "manager last"]);
  const managerName = [managerFName, managerMName, managerLName].filter(Boolean).join(" ");
  const businessName = normalizeHeader(row, ["BusinessName", "Business Name"]);
  const fullName = normalizeHeader(row, ["full name", "fullname", "name", "contact name"]) || businessName || managerName;
  const phoneNumber =
    normalizeHeader(row, ["phone number", "phone", "mobile", "mangerphone", "managerphone", "manager phone", "business number"]) ||
    normalizeHeader(row, ["BussinessTelephone", "Business Telephone"]);
  const email = normalizeHeader(row, ["email", "email address"]);
  const phase = normalizeHeader(row, ["phase", "status"]).toUpperCase().replace(/[-\s]/g, "_");

  if (!fullName || !phoneNumber) return null;

  return {
    fullName,
    phoneNumber,
    email,
    assignedToId,
    createdById,
    phase: phaseValues.includes(phase as LeadPhase) ? (phase as LeadPhase) : LeadPhase.NEW,
    appointmentDate: parseOptionalDate(normalizeHeader(row, ["appointment date", "appointmentdate", "appointment"])),
    dateRegistered: parseOptionalDate(normalizeHeader(row, ["DateRegistered", "Date Registered"])),
    legalStatusNameEng: normalizeHeader(row, ["LegalStatusNameEng", "Business Type"]),
    legalStatusNameAmh: normalizeExact(row, "LegalStatusNameAmh"),
    status: normalizeExact(row, "Status"),
    licenceNumber: normalizeHeader(row, ["LicenceNumber", "License Number", "TIN"]),
    renewedTo: parseOptionalDate(normalizeHeader(row, ["RenewedTo", "Renewed To"])),
    siteId: normalizeExact(row, "SiteID"),
    businessName,
    businessNameAmharic: normalizeExact(row, "BusinessNameAmharic"),
    managerFName,
    managerMName,
    managerLName,
    description: normalizeExact(row, "description"),
    code: normalizeHeader(row, ["Code", "Sector"]),
    englishDescription: normalizeHeader(row, ["EnglishDescription", "Sector Category"]),
    amDescription: normalizeExact(row, "Amdiscrption"),
    subGroup: normalizeExact(row, "SubGroup"),
    subGroupAm: normalizeExact(row, "SubGroupAM"),
    subGroupEn: normalizeExact(row, "SubGroupEN"),
    businessRegion: normalizeHeader(row, ["BussinessdescriptionRegion", "Business Region", "Region"]),
    businessZone: normalizeExact(row, "BussinessDescriptionZones"),
    businessWoreda: normalizeHeader(row, ["BussinessDescriptionWoredas", "Subcity", "Woreda"]),
    businessKebele: normalizeExact(row, "BussinessAmharickebeles"),
    houseNumber: normalizeExact(row, "HousNum"),
    businessTelephone: normalizeHeader(row, ["BussinessTelephone", "Business Telephone", "Business Number"])
  };
}

function normalizeKey(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function duplicateKey(lead: Pick<Prisma.LeadCreateManyInput, "phoneNumber" | "licenceNumber">) {
  const phone = normalizeKey(lead.phoneNumber);
  const license = normalizeKey(lead.licenceNumber);
  return { phone, license };
}

export async function prepareLeadImport(prisma: PrismaClient, candidates: LeadImportCandidate[]) {
  const skipped: SkippedLeadRow[] = [];
  const validCandidates: Array<LeadImportCandidate & { lead: Prisma.LeadCreateManyInput }> = [];
  const filePhones = new Set();
  const fileLicenses = new Set();

  for (const candidate of candidates) {
    if (!candidate.lead) {
      skipped.push({ row: candidate.rowNumber, reason: "Missing business/name or phone" });
      continue;
    }

    const { phone, license } = duplicateKey(candidate.lead);
    if ((phone && filePhones.has(phone)) || (license && fileLicenses.has(license))) {
      skipped.push({ row: candidate.rowNumber, reason: "Duplicate inside uploaded file", lead: candidate.lead.fullName });
      continue;
    }

    if (phone) filePhones.add(phone);
    if (license) fileLicenses.add(license);
    validCandidates.push(candidate as LeadImportCandidate & { lead: Prisma.LeadCreateManyInput });
  }

  const phones = [...new Set(validCandidates.map((candidate) => candidate.lead.phoneNumber).filter((value): value is string => typeof value === "string" && Boolean(value)))];
  const licenses = [...new Set(validCandidates.map((candidate) => candidate.lead.licenceNumber).filter((value): value is string => typeof value === "string" && Boolean(value)))];
  const existing = phones.length || licenses.length
    ? await prisma.lead.findMany({
        where: {
          OR: [
            ...(phones.length ? [{ phoneNumber: { in: phones } }] : []),
            ...(licenses.length ? [{ licenceNumber: { in: licenses } }] : [])
          ]
        },
        select: { phoneNumber: true, licenceNumber: true }
      })
    : [];

  const existingPhones = new Set(existing.map((lead) => normalizeKey(lead.phoneNumber)).filter(Boolean));
  const existingLicenses = new Set(existing.map((lead) => normalizeKey(lead.licenceNumber)).filter(Boolean));
  const leads: Prisma.LeadCreateManyInput[] = [];

  for (const candidate of validCandidates) {
    const { phone, license } = duplicateKey(candidate.lead);
    if ((phone && existingPhones.has(phone)) || (license && existingLicenses.has(license))) {
      skipped.push({ row: candidate.rowNumber, reason: "Already exists in CRM", lead: candidate.lead.fullName });
      continue;
    }
    leads.push(candidate.lead);
  }

  return { leads, skipped };
}
