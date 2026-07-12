import { LeadPhase } from "@prisma/client";
import { addCallNote, claimLead, createLead, importLeads, requestClaimTransfer, updateLeadPhase, updateLeadSchedule, type LeadInput } from "../leads/leadWorkflowService.js";

export const createSalesLead = ({ input, userId }: { input: LeadInput; userId: string }) => createLead({ input, actorId: userId, claimActor: true });
export const uploadSalesLeads = ({ file, userId }: { file: Express.Multer.File; userId: string }) => importLeads({ file, actorId: userId, claimActor: true, source: "sales-upload" });
export const updateSalesLeadPhase = ({ leadId, userId, phase }: { leadId: string; userId: string; phase: LeadPhase }) => updateLeadPhase({ leadId, actorId: userId, phase });
export const addSalesCallNote = ({ leadId, userId, note }: { leadId: string; userId: string; note: string }) => addCallNote({ leadId, actorId: userId, note });
export const updateSalesAppointment = ({ leadId, userId, appointmentDate }: { leadId: string; userId: string; appointmentDate?: string | null }) => updateLeadSchedule({ leadId, actorId: userId, kind: "appointment", value: appointmentDate });
export const updateSalesFollowUp = ({ leadId, userId, followUpDate }: { leadId: string; userId: string; followUpDate?: string | null }) => updateLeadSchedule({ leadId, actorId: userId, kind: "follow-up", value: followUpDate });
export const claimSalesLead = ({ leadId, userId }: { leadId: string; userId: string }) => claimLead({ leadId, actorId: userId });
export const requestSalesClaimTransfer = ({ leadId, userId, reason }: { leadId: string; userId: string; reason: string }) => requestClaimTransfer({ leadId, actorId: userId, reason });
