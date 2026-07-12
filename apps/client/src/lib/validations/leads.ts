import { z } from "zod";

export const leadFormSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required"),
  phoneNumber: z.string().trim().min(1, "Phone number is required"),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  businessName: z.string().trim().optional(),
  licenceNumber: z.string().trim().optional(),
  businessRegion: z.string().trim().optional(),
  businessWoreda: z.string().trim().optional(),
  appointmentDate: z.string().nullable().optional(),
  assignedToId: z.string().optional() // admin assignment
});

export type LeadFormInput = z.infer<typeof leadFormSchema>;
