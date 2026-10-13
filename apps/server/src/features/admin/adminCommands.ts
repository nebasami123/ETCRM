import { LeadPhase, Prisma } from "@prisma/client";
import { auth } from "../../auth/auth.js";
import { prisma } from "../../config/db.js";
import { parseBusinessDate } from "../../utils/dates.js";
import {
  bulkSetLeadClaims,
  bulkUpdateLeadPhases,
  createLead,
  importLeads,
  setLeadClaim,
  updateLead,
  type LeadInput
} from "../leads/leadWorkflowService.js";

export const createAdminSalesUser = ({ name, email, password, role = "SALES", salesType = "INTERNAL" }: { name: string; email: string; password: string; role?: "SALES" | "SALES_ADMIN"; salesType?: "INTERNAL" | "EXTERNAL" }) => createAdminSalesUserFn({ name, email, password, role, salesType });

async function createAdminSalesUserFn(input: { name: string; email: string; password: string; role: "SALES" | "SALES_ADMIN"; salesType: "INTERNAL" | "EXTERNAL" }) {
  try {
    const user = await auth.api.createUser({ body: { name: input.name, email: input.email, password: input.password, role: input.role as never } });
    if (input.role === "SALES") await prisma.user.update({ where: { id: user.user.id }, data: { salesType: input.salesType } });
    return { status: "ok" as const, user };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { status: "duplicate" as const };
    throw error;
  }
}

export async function resetAdminSalesPassword({ userId, newPassword, headers }: { userId: string; newPassword: string; headers: Headers }) {
  const user = await prisma.user.findFirst({ where: { id: userId, role: { in: ["SALES", "SALES_ADMIN"] } }, select: { id: true } });
  if (!user) return false;
  await auth.api.setUserPassword({ body: { userId, newPassword }, headers });
  await prisma.session.deleteMany({ where: { userId } });
  return true;
}

export async function setAdminManagedUserStatus(userId: string, active: boolean, adminId: string) {
  if (userId === adminId) return "forbidden" as const;
  const user = await prisma.user.findFirst({ where: { id: userId, role: { in: ["SALES", "SALES_ADMIN"] } }, select: { id: true } });
  if (!user) return "not-found" as const;
  await prisma.user.update({ where: { id: userId }, data: { banned: !active, banReason: active ? null : "Deactivated by administrator", banExpires: null } });
  if (!active) await prisma.session.deleteMany({ where: { userId } });
  return "ok" as const;
}

export async function updateAdminManagedSalesType(userId: string, salesType: "INTERNAL" | "EXTERNAL") {
  const result = await prisma.user.updateMany({ where: { id: userId, role: "SALES" }, data: { salesType } });
  return result.count > 0;
}

export const createAdminLead = ({ input, userId }: { input: LeadInput; userId: string }) => createLead({ input, actorId: userId });
export const uploadAdminLeads = ({ file, userId }: { file: Express.Multer.File; userId: string }) => importLeads({ file, actorId: userId, source: "admin-upload" });
export const assignAdminLead = ({ leadId, salesUserId, userId }: { leadId: string; salesUserId: string | null; userId: string }) => setLeadClaim({ leadId, salesUserId, adminId: userId });
export const updateAdminLead = ({ leadId, input, userId }: { leadId: string; input: LeadInput; userId: string }) => updateLead({ leadId, input, actorId: userId });
export const bulkAssignAdminLeads = ({
  leadIds,
  salesUserId,
  userId
}: {
  leadIds: string[];
  salesUserId: string | null;
  userId: string;
}) => bulkSetLeadClaims({ leadIds, adminId: userId, salesUserId });
export const bulkPhaseAdminLeads = ({
  leadIds,
  phase,
  creditedUserId,
  userId
}: {
  leadIds: string[];
  phase: LeadPhase;
  creditedUserId?: string | null;
  userId: string;
}) => bulkUpdateLeadPhases({ leadIds, adminId: userId, phase, creditedUserId });

export async function upsertAdminQuota(input: { salesUserId: string; date: string; callsTarget: number; leadsTarget: number }) {
  return prisma.quota.upsert({
    where: { salesUserId_date: { salesUserId: input.salesUserId, date: parseBusinessDate(input.date) } },
    update: { callsTarget: input.callsTarget, leadsTarget: input.leadsTarget },
    create: { salesUserId: input.salesUserId, date: parseBusinessDate(input.date), callsTarget: input.callsTarget, leadsTarget: input.leadsTarget },
    include: { salesUser: { select: { id: true, name: true, email: true, role: true } } }
  });
}
