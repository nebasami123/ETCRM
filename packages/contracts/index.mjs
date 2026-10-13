import { z } from "zod";

export const salesPipelineStages = [
  "Lead",
  "Contacted",
  "Meeting Booked",
  "Showed Up",
  "Demo / Presentation",
  "Proposal",
  "Negotiation",
  "Closed Won",
  "Closed Lost"
];

export const leadInputSchema = z.object({
  fullName: z.string().trim().min(1),
  phoneNumber: z.string().trim().min(1).refine((value) => {
    const digits = value.replace(/\D/g, "");
    return /^\+?[0-9][0-9\s().-]*$/.test(value) && digits.length >= 7 && digits.length <= 15;
  }, "Enter a valid phone number (7–15 digits)"),
  email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
  appointmentDate: z.string().nullable().optional(),
  nextFollowUpAt: z.string().nullable().optional(),
  pipelineStage: z.enum(salesPipelineStages).optional(),
  leadSource: z.string().trim().max(100).optional(),
  leadSourceDetail: z.string().trim().max(200).optional(),
  note: z.string().trim().max(5000).optional()
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50)
});

export const leadPhases = ["NEW", "CONTACTED", "FOLLOW_UP", "N_A", "CLOSED_WON", "CLOSED_LOST"];

export const transferReasonSchema = z.object({
  reason: z.string().trim().min(3).max(1000)
});

export const bulkAssignSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(200),
  salesUserId: z.string().nullable()
});

export const bulkPhaseSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(200),
  phase: z.enum(["NEW", "CONTACTED", "FOLLOW_UP", "N_A", "CLOSED_WON", "CLOSED_LOST"]),
  creditedUserId: z.string().nullable().optional()
});
