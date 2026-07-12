import { z } from "zod";

export const quotaSchema = z.object({
  salesUserId: z.string().min(1, "Select a salesperson"),
  date: z.string().min(1, "Select a date"),
  callsTarget: z.number().int().min(0, "Must be at least 0"),
  leadsTarget: z.number().int().min(0, "Must be at least 0")
});

export type QuotaInput = z.infer<typeof quotaSchema>;
