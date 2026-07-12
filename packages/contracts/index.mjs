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
