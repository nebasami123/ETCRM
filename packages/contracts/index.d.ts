import { z } from "zod";

export declare const salesPipelineStages: readonly [
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
export type SalesPipelineStage = (typeof salesPipelineStages)[number];

export declare const leadInputSchema: z.ZodObject<{
  fullName: z.ZodString;
  phoneNumber: z.ZodEffects<z.ZodString, string, string>;
  email: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
  appointmentDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
  nextFollowUpAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    pipelineStage: z.ZodOptional<z.ZodEnum<typeof salesPipelineStages>>;
    leadSource: z.ZodOptional<z.ZodString>;
    leadSourceDetail: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
}>;

export declare const paginationSchema: z.ZodObject<{
  page: z.ZodDefault<z.ZodNumber>;
  pageSize: z.ZodDefault<z.ZodNumber>;
}>;

export declare const leadPhases: readonly ["NEW", "CONTACTED", "FOLLOW_UP", "N_A", "CLOSED_WON", "CLOSED_LOST"];

export declare const transferReasonSchema: z.ZodObject<{
  reason: z.ZodString;
}>;

export declare const bulkAssignSchema: z.ZodObject<{
  leadIds: z.ZodArray<z.ZodString>;
  salesUserId: z.ZodNullable<z.ZodString>;
}>;

export declare const bulkPhaseSchema: z.ZodObject<{
  leadIds: z.ZodArray<z.ZodString>;
  phase: z.ZodEnum<["NEW", "CONTACTED", "FOLLOW_UP", "N_A", "CLOSED_WON", "CLOSED_LOST"]>;
  creditedUserId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}>;

export type LeadInput = z.infer<typeof leadInputSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
