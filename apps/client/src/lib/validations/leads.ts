import { z } from "zod";
import { leadSources } from "../constants/lead-sources";

export const phoneNumberSchema = z.string().trim().min(1, "Phone number is required").refine((value) => {
  const digits = value.replace(/\D/g, "");
  return /^\+?[0-9][0-9\s().-]*$/.test(value) && digits.length >= 7 && digits.length <= 15;
}, "Enter a valid phone number (7–15 digits)");

export const emailAddressSchema = z.string().trim().email("Enter a valid email address").optional().or(z.literal(""));

export const leadContactSchema = z.object({
  phoneNumber: phoneNumberSchema,
  email: emailAddressSchema
});

export const leadFormSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required"),
  phoneNumber: phoneNumberSchema,
  email: emailAddressSchema,
  leadSource: z.enum(leadSources).optional().or(z.literal("")),
  leadSourceDetail: z.string().trim().max(200, "Keep the source detail under 200 characters").optional().or(z.literal("")),
  appointmentDate: z.string().nullable().optional(),
  nextFollowUpAt: z.string().nullable().optional(),
  assignedToId: z.string().optional() // admin assignment
});

export type LeadFormInput = z.infer<typeof leadFormSchema>;
