import { LeadPhase } from "@prisma/client";
import {
  addCallNote,
  createLead,
  importLeads,
  requestClaimTransfer,
  updateLeadPhase,
  updateLeadSchedule,
  type LeadInput
} from "../leads/leadWorkflowService.js";

export const createSalesLead = ({ input, userId }: { input: LeadInput; userId: string }) =>
  createLead({ input, actorId: userId, claimActor: true });

export const uploadSalesLeads = ({ file, userId }: { file: Express.Multer.File; userId: string }) =>
  importLeads({ file, actorId: userId, claimActor: true, source: "sales-upload" });

/**
 * Sales phase updates: claimer-only via workflow, and CLOSED_WON is never allowed
 * (admin must set won + conversion credit).
 */
export async function updateSalesLeadPhase({
  leadId,
  userId,
  phase
}: {
  leadId: string;
  userId: string;
  phase: LeadPhase;
}) {
  if (phase === LeadPhase.CLOSED_WON) {
    return { status: "closed-won-forbidden" as const };
  }
  return updateLeadPhase({ leadId, actorId: userId, phase, requireOwnership: true });
}

export const addSalesCallNote = ({ leadId, userId, note }: { leadId: string; userId: string; note: string }) =>
  addCallNote({ leadId, actorId: userId, note, requireOwnership: true });

export const updateSalesAppointment = ({
  leadId,
  userId,
  appointmentDate
}: {
  leadId: string;
  userId: string;
  appointmentDate?: string | null;
}) => updateLeadSchedule({ leadId, actorId: userId, kind: "appointment", value: appointmentDate, requireOwnership: true });

export const updateSalesFollowUp = ({
  leadId,
  userId,
  followUpDate
}: {
  leadId: string;
  userId: string;
  followUpDate?: string | null;
}) => updateLeadSchedule({ leadId, actorId: userId, kind: "follow-up", value: followUpDate, requireOwnership: true });

export async function claimSalesLead({ leadId, userId }: { leadId: string; userId: string }) {
  const { claimVirtualOrPersistedLead } = await import("../leads/unifiedLeadService.js");
  return claimVirtualOrPersistedLead({ leadId, actorId: userId });
}

export const requestSalesClaimTransfer = ({
  leadId,
  userId,
  reason
}: {
  leadId: string;
  userId: string;
  reason: string;
}) => requestClaimTransfer({ leadId, actorId: userId, reason });
