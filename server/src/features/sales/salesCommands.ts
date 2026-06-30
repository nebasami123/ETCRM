import fs from "fs";
import { ActivityType, LeadPhase, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { logActivity } from "../activity/activityLogService.js";
import { buildLead, prepareLeadImport, readLeadRows } from "../leads/leadImportService.js";
import { ensureSalesLeadAccess, findDuplicateLead, parseOptionalDate } from "../leads/leadService.js";

type SalesLeadInput = {
  fullName: string;
  phoneNumber: string;
  email: string;
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

function salesLeadInclude() {
  return {
    assignedTo: { select: { id: true, name: true } },
    createdBy: { select: { id: true, name: true, role: true } },
    callNotes: { include: { agent: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } }
  } satisfies Prisma.LeadInclude;
}

export async function updateSalesLeadPhase({ leadId, userId, phase }: { leadId: string; userId: string; phase: LeadPhase }) {
  const lead = await ensureSalesLeadAccess(leadId, userId);
  if (!lead) return null;

  const shouldClaim = lead.phase === LeadPhase.NEW && phase === LeadPhase.CONTACTED;
  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: { phase, ...(shouldClaim ? { assignedToId: userId } : {}) },
    include: salesLeadInclude()
  });

  await logActivity({
    userId,
    leadId: lead.id,
    type: ActivityType.PHASE_CHANGE,
    metadata: { from: lead.phase, to: phase, claimedBy: shouldClaim ? userId : null }
  });

  return updated;
}

export async function addSalesCallNote({ leadId, userId, note }: { leadId: string; userId: string; note: string }) {
  const lead = await ensureSalesLeadAccess(leadId, userId);
  if (!lead) return null;

  const callNote = await prisma.callNote.create({
    data: { leadId: lead.id, agentId: userId, note },
    include: { agent: { select: { id: true, name: true } } }
  });

  await logActivity({ userId, leadId: lead.id, type: ActivityType.CALL_NOTE });
  return callNote;
}

export async function updateSalesAppointment({ leadId, userId, appointmentDate }: { leadId: string; userId: string; appointmentDate?: string | null }) {
  const lead = await ensureSalesLeadAccess(leadId, userId);
  if (!lead) return { status: "not-found" as const };

  const parsedAppointmentDate = appointmentDate ? new Date(appointmentDate) : null;
  if (parsedAppointmentDate && Number.isNaN(parsedAppointmentDate.getTime())) {
    return { status: "invalid-date" as const };
  }

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: { appointmentDate: parsedAppointmentDate },
    include: {
      assignedTo: { select: { id: true, name: true } },
      callNotes: { include: { agent: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } }
    }
  });

  await logActivity({
    userId,
    leadId: lead.id,
    type: ActivityType.APPOINTMENT_SET,
    metadata: { appointmentDate: parsedAppointmentDate }
  });

  return { status: "ok" as const, lead: updated };
}

export async function createSalesLead({ input, userId }: { input: SalesLeadInput; userId: string }) {
  const duplicate = await findDuplicateLead(prisma, input);
  if (duplicate) return { status: "duplicate" as const, duplicate };

  const lead = await prisma.lead.create({
    data: {
      fullName: input.fullName,
      phoneNumber: input.phoneNumber,
      email: input.email,
      phase: LeadPhase.NEW,
      assignedToId: userId,
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
    include: salesLeadInclude()
  });

  await logActivity({ userId, leadId: lead.id, type: ActivityType.LEAD_CREATED });
  return { status: "ok" as const, lead };
}

export async function uploadSalesLeads({ file, userId }: { file: Express.Multer.File; userId: string }) {
  const rows = await readLeadRows(file);
  const candidates = rows.map((row, index) => ({
    // CSV/XLSX row 1 is headers, so data index 0 maps to spreadsheet row 2.
    rowNumber: index + 2,
    lead: buildLead(row, { assignedToId: userId, createdById: userId })
  }));
  const { leads, skipped } = await prepareLeadImport(prisma, candidates);

  if (!leads.length) {
    return { status: "empty" as const, imported: 0, skipped: skipped.length, skippedRows: skipped.slice(0, 25) };
  }

  await prisma.lead.createMany({ data: leads });
  await logActivity({ userId, type: ActivityType.LEAD_CREATED, metadata: { imported: leads.length, skipped: skipped.length } });
  fs.unlink(file.path, () => {});

  return { status: "ok" as const, imported: leads.length, skipped: skipped.length, skippedRows: skipped.slice(0, 25) };
}
