import { LeadPhase, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { auth } from "../../auth/auth.js";
import { prisma } from "../../config/db.js";
import { parseBusinessDate } from "../../utils/dates.js";
import { setLeadClaim } from "../leads/leadWorkflowService.js";
import { pipelineStageForPhase, salesPipelineStages, type SalesPipelineStage } from "../leads/pipelineStage.js";

const salesOnly = { role: "SALES" };

export async function getSalesAdminDashboard() {
  const salesOwned = { OR: [{ claimedBy: salesOnly }, { createdBy: salesOnly }] };
  const [team, totalLeads, openLeads, wonLeads, lostLeads, localPipeline, registryPipeline, leaderboard] = await Promise.all([
    prisma.user.groupBy({ by: ["salesType", "banned"], where: salesOnly, _count: { _all: true } }),
    prisma.lead.count({ where: { OR: [{ claimedBy: salesOnly }, { createdBy: salesOnly }] } }),
    prisma.lead.count({ where: { phase: { notIn: [LeadPhase.CLOSED_WON, LeadPhase.CLOSED_LOST] }, OR: [{ claimedBy: salesOnly }, { createdBy: salesOnly }] } }),
    prisma.lead.count({ where: { phase: LeadPhase.CLOSED_WON, OR: [{ claimedBy: salesOnly }, { createdBy: salesOnly }] } }),
    prisma.lead.count({ where: { phase: LeadPhase.CLOSED_LOST, OR: [{ claimedBy: salesOnly }, { createdBy: salesOnly }] } }),
    prisma.lead.groupBy({ by: ["pipelineStage", "phase"], where: salesOwned, _count: { _all: true } }),
    prisma.registryLead.groupBy({ by: ["pipelineStage", "phase"], where: salesOwned, _count: { _all: true } }),
    import("../shared/leaderboardService.js").then((m) => m.buildLeaderboard())
  ]);
  const { registryLead } = prisma;
  const [registryTotal, registryOpen, registryWon, registryLost] = await Promise.all([
    registryLead.count({ where: { OR: [{ claimedBy: salesOnly }, { createdBy: salesOnly }] } }),
    registryLead.count({ where: { phase: { notIn: [LeadPhase.CLOSED_WON, LeadPhase.CLOSED_LOST] }, OR: [{ claimedBy: salesOnly }, { createdBy: salesOnly }] } }),
    registryLead.count({ where: { phase: LeadPhase.CLOSED_WON, OR: [{ claimedBy: salesOnly }, { createdBy: salesOnly }] } }),
    registryLead.count({ where: { phase: LeadPhase.CLOSED_LOST, OR: [{ claimedBy: salesOnly }, { createdBy: salesOnly }] } })
  ]);
  const groups = { INTERNAL: 0, EXTERNAL: 0, inactive: 0, active: 0 };
  for (const row of team) {
    const key = row.salesType || "INTERNAL";
    groups[key as "INTERNAL" | "EXTERNAL"] += row._count._all;
    groups[row.banned ? "inactive" : "active"] += row._count._all;
  }
  const pipelineCounts = Object.fromEntries(salesPipelineStages.map((stage) => [stage, 0])) as Record<SalesPipelineStage, number>;
  for (const row of [...localPipeline, ...registryPipeline]) {
    const stage = row.pipelineStage && salesPipelineStages.includes(row.pipelineStage as SalesPipelineStage)
      ? row.pipelineStage as SalesPipelineStage
      : pipelineStageForPhase(row.phase);
    pipelineCounts[stage] += row._count._all;
  }
  return {
    team: groups,
    leads: { total: totalLeads + registryTotal, open: openLeads + registryOpen, won: wonLeads + registryWon, lost: lostLeads + registryLost },
    pipeline: salesPipelineStages.map((stage) => ({ stage, count: pipelineCounts[stage] })),
    leaderboard: leaderboard.slice(0, 8)
  };
}

export function listSalesAdminTeam() {
  return prisma.user.findMany({
    where: salesOnly,
    select: { id: true, name: true, email: true, role: true, salesType: true, banned: true, createdAt: true },
    orderBy: { name: "asc" }
  });
}

export async function createSalesAdminRep(input: { name: string; email: string; password: string; salesType: "INTERNAL" | "EXTERNAL" }) {
  try {
    const created = await auth.api.createUser({ body: { name: input.name, email: input.email, password: input.password, role: "SALES" as never } });
    await prisma.user.update({ where: { id: created.user.id }, data: { salesType: input.salesType } });
    return { status: "ok" as const };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { status: "duplicate" as const };
    throw error;
  }
}

export async function resetSalesAdminPassword(userId: string, newPassword: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, role: "SALES" }, select: { id: true } });
  if (!user) return false;
  const context = await auth.$context;
  const password = await context.password.hash(newPassword);
  const account = await prisma.account.findFirst({ where: { userId, providerId: "credential" }, select: { id: true } });
  if (!account) {
    await prisma.account.create({ data: { id: randomUUID(), accountId: userId, providerId: "credential", userId, password } });
  } else {
    await prisma.account.update({ where: { id: account.id }, data: { password } });
  }
  await prisma.session.deleteMany({ where: { userId } });
  return true;
}

export async function setSalesAdminRepStatus(userId: string, active: boolean, managerId: string) {
  if (userId === managerId) return "forbidden" as const;
  const user = await prisma.user.findFirst({ where: { id: userId, role: "SALES" }, select: { id: true } });
  if (!user) return "not-found" as const;
  await prisma.user.update({ where: { id: userId }, data: { banned: !active, banReason: active ? null : "Deactivated by Sales Admin", banExpires: null } });
  if (!active) await prisma.session.deleteMany({ where: { userId } });
  return "ok" as const;
}

export async function updateSalesAdminRepType(userId: string, salesType: "INTERNAL" | "EXTERNAL") {
  const updated = await prisma.user.updateMany({ where: { id: userId, role: "SALES" }, data: { salesType } });
  return updated.count > 0;
}

export async function listSalesAdminLeads(input: { search?: string; pipelineStage?: string; page: number; pageSize: number }) {
  const ids = (await prisma.user.findMany({ where: salesOnly, select: { id: true } })).map((user) => user.id);
  if (!ids.length) return { leads: [], pagination: { page: input.page, pageSize: input.pageSize, total: 0, totalPages: 0 } };
  const { listCrmLeads } = await import("../leads/crmListService.js");
  return listCrmLeads({ search: input.search, pipelineStage: input.pipelineStage, salesUserIds: ids, page: input.page, pageSize: input.pageSize, orderBy: "updatedAt" });
}

export async function assignSalesAdminLead(leadId: string, salesUserId: string | null, managerId: string) {
  const [target, local, registry] = await Promise.all([
    salesUserId ? prisma.user.findFirst({ where: { id: salesUserId, role: "SALES", OR: [{ banned: false }, { banned: null }] }, select: { id: true } }) : Promise.resolve({ id: "unassigned" }),
    prisma.lead.findFirst({ where: { id: leadId, OR: [{ claimedBy: salesOnly }, { createdBy: salesOnly }] }, select: { id: true } }),
    prisma.registryLead.findFirst({ where: { id: leadId, OR: [{ claimedBy: salesOnly }, { createdBy: salesOnly }] }, select: { id: true } })
  ]);
  if (salesUserId && !target) return "invalid-target" as const;
  if (!local && !registry) return "not-found" as const;
  await setLeadClaim({ leadId, salesUserId, adminId: managerId });
  return "ok" as const;
}

export async function listSalesAdminActivity(input: { page: number; limit: number }) {
  const users = await prisma.user.findMany({ where: salesOnly, select: { id: true } });
  const ids = users.map((user) => user.id);
  const ownedIds = ids.length ? await Promise.all([
    prisma.lead.findMany({ where: { OR: [{ claimedById: { in: ids } }, { createdById: { in: ids } }] }, select: { id: true } }),
    prisma.registryLead.findMany({ where: { OR: [{ claimedById: { in: ids } }, { createdById: { in: ids } }] }, select: { id: true } })
  ]) : [[], []];
  const leadIds = [...ownedIds[0], ...ownedIds[1]].map((row) => row.id);
  const where = { OR: [{ actorId: { in: ids } }, { leadId: { in: leadIds } }] };
  const [activities, total] = await prisma.$transaction([
    prisma.activityEvent.findMany({ where, include: { actor: { select: { id: true, name: true, email: true, role: true } }, creditedUser: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, skip: (input.page - 1) * input.limit, take: input.limit }),
    prisma.activityEvent.count({ where })
  ]);
  const localIds = activities.filter((event) => event.leadKind === "LOCAL" && event.leadId).map((event) => event.leadId!);
  const regIds = activities.filter((event) => event.leadKind === "REGISTRY" && event.leadId).map((event) => event.leadId!);
  const [locals, registries] = await Promise.all([
    prisma.lead.findMany({ where: { id: { in: localIds } }, select: { id: true, fullName: true, phoneNumber: true, phase: true } }),
    prisma.registryLead.findMany({ where: { id: { in: regIds } }, select: { id: true, displayName: true, phoneNumber: true, phase: true } })
  ]);
  const map = new Map([...locals.map((lead) => [lead.id, lead] as const), ...registries.map((lead) => [lead.id, { id: lead.id, fullName: lead.displayName, phoneNumber: lead.phoneNumber, phase: lead.phase }] as const)]);
  return { activities: activities.map((event) => ({ ...event, lead: event.leadId ? map.get(event.leadId) ?? null : null })), pagination: { page: input.page, pageSize: input.limit, total, totalPages: Math.ceil(total / input.limit) } };
}

export async function listSalesAdminQuotas(date: string) {
  return prisma.quota.findMany({ where: { date: parseBusinessDate(date), salesUser: salesOnly }, include: { salesUser: { select: { id: true, name: true, email: true } } }, orderBy: { salesUser: { name: "asc" } } });
}

export async function saveSalesAdminQuota(input: { salesUserId: string; date: string; callsTarget: number; leadsTarget: number }) {
  const user = await prisma.user.findFirst({ where: { id: input.salesUserId, role: "SALES", OR: [{ banned: false }, { banned: null }] }, select: { id: true } });
  if (!user) return null;
  return prisma.quota.upsert({ where: { salesUserId_date: { salesUserId: input.salesUserId, date: parseBusinessDate(input.date) } }, update: { callsTarget: input.callsTarget, leadsTarget: input.leadsTarget }, create: { salesUserId: input.salesUserId, date: parseBusinessDate(input.date), callsTarget: input.callsTarget, leadsTarget: input.leadsTarget } });
}

