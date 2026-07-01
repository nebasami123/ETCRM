import { LeadPhase, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../config/db.js";

export function parseOptionalDate(value: unknown) {
  if (!value) return null;
  if (!(value instanceof Date) && typeof value !== "string" && typeof value !== "number") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function findDuplicateLead(
  client: PrismaClient,
  { phoneNumber, licenceNumber, excludeId }: { phoneNumber?: string | null; licenceNumber?: string | null; excludeId?: string } = {}
) {
  const phone = String(phoneNumber || "").trim();
  const license = String(licenceNumber || "").trim();
  if (!phone && !license) return null;

  return client.lead.findFirst({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [
        ...(phone ? [{ phoneNumber: phone }] : []),
        ...(license ? [{ licenceNumber: license }] : [])
      ]
    },
    select: { id: true, fullName: true, phoneNumber: true, licenceNumber: true }
  });
}

export async function ensureSalesLeadAccess(leadId: string, userId: string) {
  return prisma.lead.findFirst({
    where: {
      id: leadId,
      OR: [
        { assignedToId: userId },
        { createdById: userId },
        // Unassigned new leads are intentionally visible so sales agents can claim them.
        { assignedToId: null, phase: LeadPhase.NEW }
      ]
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, role: true } },
      callNotes: {
        include: { agent: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" }
      }
    }
  });
}

export function leadCreateDataFromInput(
  input: {
    fullName: string;
    phoneNumber: string;
    email: string;
    phase?: LeadPhase;
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
  },
  defaults: { phase: LeadPhase; assignedToId?: string | null; createdById: string }
): Prisma.LeadCreateInput {
  return {
    fullName: input.fullName,
    phoneNumber: input.phoneNumber,
    email: input.email,
    phase: input.phase || defaults.phase,
    assignedTo: defaults.assignedToId || input.assignedToId ? { connect: { id: defaults.assignedToId || input.assignedToId || "" } } : undefined,
    createdBy: { connect: { id: defaults.createdById } },
    appointmentDate: parseOptionalDate(input.appointmentDate),
    businessName: input.businessName,
    licenceNumber: input.licenceNumber,
    businessRegion: input.businessRegion,
    businessZone: input.businessZone,
    businessWoreda: input.businessWoreda,
    businessKebele: input.businessKebele,
    houseNumber: input.houseNumber,
    businessTelephone: input.businessTelephone
  };
}
