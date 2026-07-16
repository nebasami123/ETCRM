import { z } from "zod";

export const leadInputSchema = z.object({
  fullName: z.string().trim().min(1),
  phoneNumber: z.string().trim().min(1),
  email: z.string().trim().optional(),
  appointmentDate: z.string().nullable().optional(),
  nextFollowUpAt: z.string().nullable().optional(),
  businessName: z.string().trim().optional(),
  licenceNumber: z.string().trim().optional(),
  businessRegion: z.string().trim().optional(),
  businessZone: z.string().trim().optional(),
  businessWoreda: z.string().trim().optional(),
  businessKebele: z.string().trim().optional(),
  houseNumber: z.string().trim().optional(),
  businessTelephone: z.string().trim().optional()
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50)
});

export const leadPhases = ["NEW", "CONTACTED", "FOLLOW_UP", "CLOSED_WON", "CLOSED_LOST"];

export const transferReasonSchema = z.object({
  reason: z.string().trim().min(3).max(1000)
});

export const bulkAssignSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(200),
  salesUserId: z.string().nullable()
});

export const bulkPhaseSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(200),
  phase: z.enum(["NEW", "CONTACTED", "FOLLOW_UP", "CLOSED_WON", "CLOSED_LOST"]),
  creditedUserId: z.string().nullable().optional()
});
