import { Prisma } from "@prisma/client";
import { auth } from "../../auth/auth.js";
import { prisma } from "../../config/db.js";
import { parseBusinessDate } from "../../utils/dates.js";
import { createLead, importLeads, setLeadClaim, type LeadInput } from "../leads/leadWorkflowService.js";

export async function createAdminSalesUser(input: { name: string; email: string; password: string }) {
  try {
    const user = await auth.api.createUser({ body: { ...input, role: "SALES" as never } });
    return { status: "ok" as const, user };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { status: "duplicate" as const };
    throw error;
  }
}

export async function resetAdminSalesPassword({ userId, newPassword, headers }: { userId: string; newPassword: string; headers: Headers }) {
  const user = await prisma.user.findFirst({ where: { id: userId, role: "SALES" }, select: { id: true } });
  if (!user) return false;
  await auth.api.setUserPassword({ body: { userId, newPassword }, headers });
  await prisma.session.deleteMany({ where: { userId } });
  return true;
}

export const createAdminLead = ({ input, userId }: { input: LeadInput; userId: string }) => createLead({ input, actorId: userId });
export const uploadAdminLeads = ({ file, userId }: { file: Express.Multer.File; userId: string }) => importLeads({ file, actorId: userId, source: "admin-upload" });
export const assignAdminLead = ({ leadId, salesUserId, userId }: { leadId: string; salesUserId: string | null; userId: string }) => setLeadClaim({ leadId, salesUserId, adminId: userId });

export async function upsertAdminQuota(input: { salesUserId: string; date: string; callsTarget: number; leadsTarget: number }) {
  return prisma.quota.upsert({
    where: { salesUserId_date: { salesUserId: input.salesUserId, date: parseBusinessDate(input.date) } },
    update: { callsTarget: input.callsTarget, leadsTarget: input.leadsTarget },
    create: { salesUserId: input.salesUserId, date: parseBusinessDate(input.date), callsTarget: input.callsTarget, leadsTarget: input.leadsTarget },
    include: { salesUser: { select: { id: true, name: true, email: true, role: true } } }
  });
}
