import { LeadPhase, Prisma } from "@prisma/client";

export const leadDetailInclude = {
  createdBy: { select: { id: true, name: true, email: true, role: true } },
  claimedBy: { select: { id: true, name: true, email: true, role: true } }
} satisfies Prisma.LeadInclude;

export function phoneKey(value: string) {
  const normalized = value.replace(/\D/g, "");
  if (!normalized) throw new Error("Phone number must contain digits");
  return normalized;
}

export function licenceKey(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || null;
}

export function isSalesRole(role: string) {
  return role === "SALES";
}

export function assertLeadPhase(value: string): LeadPhase {
  if (!Object.values(LeadPhase).includes(value as LeadPhase)) throw new Error("Invalid lead phase");
  return value as LeadPhase;
}
