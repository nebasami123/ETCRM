import fs from "fs";
import bcrypt from "bcryptjs";
import { ActivityType, LeadPhase, Role } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { logActivity } from "../activity/activityLogService.js";
import { buildLead, prepareLeadImport, readLeadRows } from "../leads/leadImportService.js";
import { findDuplicateLead, parseOptionalDate } from "../leads/leadService.js";
import { parseDay } from "../../utils/dates.js";

type SalesUserInput = {
  name: string;
  email: string;
  password: string;
};

type AdminLeadInput = {
  fullName: string;
  phoneNumber: string;
  email: string;
  phase: LeadPhase;
  assignedToId?: string | null;
  appointmentDate?: string | null;
  businessName: string;
  licenceNumber: string;
  businessRegion: string;
  businessZone: string;
  businessWoreda: string;
  businessKebele: string;
  houseNumber: string;
  businessTelephone: string;
};

export async function createAdminSalesUser(input: SalesUserInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) return { status: "duplicate" as const };

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: Role.SALES
    },
    select: { id: true, name: true, email: true }
  });

  return { status: "ok" as const, user };
}

export async function uploadAdminLeads({ file, userId }: { file: Express.Multer.File; userId: string }) {
  const salesUsers = await prisma.user.findMany({ where: { role: Role.SALES }, select: { id: true } });
  const rows = await readLeadRows(file);

  const candidates = rows.map((row, index) => {
    const assignedToId = salesUsers[index % salesUsers.length]?.id || null;
    // CSV/XLSX row 1 is headers, so data index 0 maps to spreadsheet row 2.
    return { rowNumber: index + 2, lead: buildLead(row, { assignedToId, createdById: userId }) };
  });
  const { leads, skipped } = await prepareLeadImport(prisma, candidates);

  if (!leads.length) {
    fs.unlink(file.path, () => {});
    return { status: "empty" as const, imported: 0, skipped: skipped.length, skippedRows: skipped.slice(0, 25) };
  }

  await prisma.lead.createMany({ data: leads });
  await logActivity({
    userId,
    type: ActivityType.LEAD_CREATED,
    metadata: { imported: leads.length, skipped: skipped.length, source: "admin-upload" }
  });
  fs.unlink(file.path, () => {});

  return { status: "ok" as const, imported: leads.length, skipped: skipped.length, skippedRows: skipped.slice(0, 25) };
}

export async function createAdminLead({ input, userId }: { input: AdminLeadInput; userId: string }) {
  const duplicate = await findDuplicateLead(prisma, input);
  if (duplicate) return { status: "duplicate" as const, duplicate };

  const lead = await prisma.lead.create({
    data: {
      fullName: input.fullName,
      phoneNumber: input.phoneNumber,
      email: input.email,
      phase: input.phase,
      assignedToId: input.assignedToId || null,
      createdById: userId,
      appointmentDate: parseOptionalDate(input.appointmentDate),
      businessName: input.businessName,
      licenceNumber: input.licenceNumber,
      businessRegion: input.businessRegion,
      businessZone: input.businessZone,
      businessWoreda: input.businessWoreda,
      businessKebele: input.businessKebele,
      houseNumber: input.houseNumber,
      businessTelephone: input.businessTelephone
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, role: true } }
    }
  });

  await logActivity({ userId, leadId: lead.id, type: ActivityType.LEAD_CREATED });
  return { status: "ok" as const, lead };
}

export async function assignAdminLead({ leadId, salesUserId, userId }: { leadId: string; salesUserId: string | null; userId: string }) {
  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: { assignedToId: salesUserId },
    include: {
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, role: true } }
    }
  });

  await logActivity({
    userId,
    leadId: lead.id,
    type: ActivityType.LEAD_ASSIGNED,
    metadata: { assignedToId: salesUserId }
  });

  return lead;
}

export async function upsertAdminQuota(input: { salesUserId: string; date: string; callsTarget: number; leadsTarget: number }) {
  const date = parseDay(input.date);

  return prisma.quota.upsert({
    where: { salesUserId_date: { salesUserId: input.salesUserId, date } },
    update: { callsTarget: input.callsTarget, leadsTarget: input.leadsTarget },
    create: { salesUserId: input.salesUserId, date, callsTarget: input.callsTarget, leadsTarget: input.leadsTarget },
    include: { salesUser: { select: { id: true, name: true, email: true } } }
  });
}
