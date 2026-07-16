import { z } from "zod";

export declare const leadInputSchema: z.ZodObject<{
  fullName: z.ZodString;
  phoneNumber: z.ZodString;
  email: z.ZodOptional<z.ZodString>;
  appointmentDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
  nextFollowUpAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
  businessName: z.ZodOptional<z.ZodString>;
  licenceNumber: z.ZodOptional<z.ZodString>;
  businessRegion: z.ZodOptional<z.ZodString>;
  businessZone: z.ZodOptional<z.ZodString>;
  businessWoreda: z.ZodOptional<z.ZodString>;
  businessKebele: z.ZodOptional<z.ZodString>;
  houseNumber: z.ZodOptional<z.ZodString>;
  businessTelephone: z.ZodOptional<z.ZodString>;
}>;

export declare const paginationSchema: z.ZodObject<{
  page: z.ZodDefault<z.ZodNumber>;
  pageSize: z.ZodDefault<z.ZodNumber>;
}>;

export declare const leadPhases: readonly ["NEW", "CONTACTED", "FOLLOW_UP", "CLOSED_WON", "CLOSED_LOST"];

export declare const transferReasonSchema: z.ZodObject<{
  reason: z.ZodString;
}>;

export declare const bulkAssignSchema: z.ZodObject<{
  leadIds: z.ZodArray<z.ZodString>;
  salesUserId: z.ZodNullable<z.ZodString>;
}>;

export declare const bulkPhaseSchema: z.ZodObject<{
  leadIds: z.ZodArray<z.ZodString>;
  phase: z.ZodEnum<["NEW", "CONTACTED", "FOLLOW_UP", "CLOSED_WON", "CLOSED_LOST"]>;
  creditedUserId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}>;

export type LeadInput = z.infer<typeof leadInputSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
