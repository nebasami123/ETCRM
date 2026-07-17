import { ActivityType, CampaignStatus, LeadKind, LeadPhase, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import {
  claimRegistryLead,
  selectRegistryLeadsForCampaign,
  type CampaignCandidate,
  type CampaignSortMode
} from "../registry/registryService.js";
import { setLeadClaim } from "../leads/leadWorkflowService.js";
import type { CampaignAllocationInput, CampaignFiltersSnapshot, CreateCampaignInput, LaunchCampaignInput } from "./campaignTypes.js";
import { CAMPAIGN_SORT_MODES } from "./campaignTypes.js";
import { getExcludedPhoneKeys } from "./campaignExclusion.js";

export { getExcludedPhoneKeys };

function asFilters(value: unknown): CampaignFiltersSnapshot {
  if (!value || typeof value !== "object") return {};
  const raw = value as Record<string, unknown>;
  const num = (v: unknown) => {
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const str = (v: unknown) => {
    const s = String(v ?? "").trim();
    return s || undefined;
  };
  const sectors = (() => {
    if (Array.isArray(raw.sector)) {
      return [...new Set(raw.sector.map((item) => String(item ?? "").trim()).filter(Boolean))];
    }
    const single = str(raw.sector);
    return single ? [single] : undefined;
  })();
  return {
    region: str(raw.region),
    subcity: str(raw.subcity),
    sector: sectors?.length ? sectors : undefined,
    nationality: str(raw.nationality),
    businessType: str(raw.businessType),
    capitalMin: num(raw.capitalMin),
    capitalMax: num(raw.capitalMax),
    scoreMin: num(raw.scoreMin),
    scoreMax: num(raw.scoreMax)
  };
}

function asSortMode(value: unknown): CampaignSortMode {
  const mode = String(value || "capital_desc");
  return (CAMPAIGN_SORT_MODES as readonly string[]).includes(mode) ? (mode as CampaignSortMode) : "capital_desc";
}

/** Short badge tag derived from the campaign name (e.g. "Q3 High Capital Addis" → "Q3 · High · Capital"). */
export function campaignLabelFromName(name: string): string | null {
  const words = name
    .trim()
    .split(/[\s_/|·•,.-]+/)
    .map((w) => w.trim())
    .filter(Boolean);
  if (!words.length) return null;
  const tag = words.slice(0, 3).join(" · ");
  return tag.length > 32 ? `${tag.slice(0, 31).trimEnd()}…` : tag;
}

const MAX_ALLOCATION_COUNT = 100_000;

function normalizeAllocations(allocations: CampaignAllocationInput[] | undefined) {
  const map = new Map<string, { count: number; dailyContactGoal: number }>();
  for (const row of allocations || []) {
    const userId = String(row.userId || "").trim();
    const count = Math.max(0, Math.min(MAX_ALLOCATION_COUNT, Math.floor(Number(row.count) || 0)));
    const dailyContactGoal = Math.max(0, Math.min(MAX_ALLOCATION_COUNT, Math.floor(Number(row.dailyContactGoal) || 0)));
    if (!userId || count <= 0) continue;
    const prev = map.get(userId);
    map.set(userId, {
      count: (prev?.count || 0) + count,
      dailyContactGoal: Math.max(prev?.dailyContactGoal || 0, dailyContactGoal)
    });
  }
  return [...map.entries()].map(([userId, value]) => ({
    userId,
    count: value.count,
    dailyContactGoal: value.dailyContactGoal
  }));
}

export async function selectForCampaign(input: {
  filters: CampaignFiltersSnapshot;
  sortMode: CampaignSortMode;
  limit: number;
  excludePhoneKeys: Set<string>;
}) {
  return selectRegistryLeadsForCampaign({
    filters: input.filters,
    sortMode: input.sortMode,
    limit: input.limit,
    excludePhoneKeys: input.excludePhoneKeys
  });
}

const MAX_POOL_SIZE = 500;

/**
 * Build a unique-phone lead pool on a DRAFT campaign (no agent assignment yet).
 * Step 2 of the wizard: filters → prepare pool → then assign/launch.
 */
export async function prepareCampaignPool(input: {
  campaignId: string;
  filters?: CampaignFiltersSnapshot;
  sortMode?: CampaignSortMode;
  poolSize: number;
}) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    select: { id: true, status: true, filters: true, sortMode: true, _count: { select: { leads: true } } }
  });
  if (!campaign) return { status: "not-found" as const };
  if (campaign.status !== CampaignStatus.DRAFT) {
    return { status: "invalid" as const, message: "Only draft campaigns can prepare a lead pool" };
  }

  const alreadyAssigned = await prisma.campaignLead.count({
    where: { campaignId: campaign.id, assignedToId: { not: null } }
  });
  if (alreadyAssigned > 0) {
    return { status: "invalid" as const, message: "Campaign already has assigned leads" };
  }

  const poolSize = Math.max(1, Math.min(MAX_POOL_SIZE, Math.floor(Number(input.poolSize) || 0)));
  if (!poolSize) {
    return { status: "invalid" as const, message: "Pool size must be at least 1" };
  }

  const filters = asFilters(input.filters ?? campaign.filters);
  const sortMode = asSortMode(input.sortMode ?? campaign.sortMode);
  const excludePhoneKeys = await getExcludedPhoneKeys();

  let selection: Awaited<ReturnType<typeof selectForCampaign>>;
  try {
    selection = await selectForCampaign({
      filters,
      sortMode,
      limit: poolSize,
      excludePhoneKeys
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to select leads from directory";
    const timedOut =
      (error as { code?: string })?.code === "CAMPAIGN_SELECT_TIMEOUT" ||
      message.includes("timed out") ||
      message.includes("operation exceeded time limit");
    return {
      status: "invalid" as const,
      message: timedOut
        ? "Directory search timed out. Narrow your filters (region, sector, or capital range) and try again."
        : message
    };
  }

  if (!selection.candidates.length) {
    return {
      status: "empty" as const,
      message: "No eligible leads matched your filters (worked/claimed/active-campaign phones are excluded)"
    };
  }

  await prisma.$transaction(async (db) => {
    await db.campaignLead.deleteMany({ where: { campaignId: campaign.id } });
    await db.campaignLead.createMany({
      data: selection.candidates.map((row) => ({
        campaignId: campaign.id,
        phoneKey: row.phoneKey,
        phoneNumber: row.phoneNumber,
        externalBusinessId: row.mongoBusinessId,
        fullName: row.fullName,
        businessName: row.businessName || null,
        capital: row.capital,
        region: row.region || null,
        subcity: row.subcity || null,
        leadKind: null,
        leadId: null,
        assignedToId: null,
        assignedAt: null
      })),
      skipDuplicates: true
    });
    await db.campaign.update({
      where: { id: campaign.id },
      data: {
        filters: filters as Prisma.InputJsonValue,
        sortMode
      }
    });
  });

  const poolCount = await prisma.campaignLead.count({ where: { campaignId: campaign.id } });
  return {
    status: "ok" as const,
    campaignId: campaign.id,
    requested: poolSize,
    poolSize: poolCount,
    scannedBusinesses: selection.scannedBusinesses,
    exhausted: selection.exhausted,
    sample: selection.candidates.slice(0, 8).map((row) => ({
      fullName: row.fullName,
      businessName: row.businessName,
      phoneNumber: row.phoneNumber,
      capital: row.capital,
      region: row.region,
      subcity: row.subcity
    }))
  };
}

export async function createCampaign(input: CreateCampaignInput & { adminId: string }) {
  const name = input.name.trim();
  if (!name) return { status: "invalid" as const, message: "Campaign name is required" };

  const allocations = normalizeAllocations(input.allocations);
  if (allocations.length) {
    const users = await prisma.user.findMany({
      where: { id: { in: allocations.map((a) => a.userId) }, role: "SALES" },
      select: { id: true }
    });
    if (users.length !== allocations.length) {
      return { status: "invalid" as const, message: "One or more sales users are invalid" };
    }
  }

  const filters = asFilters(input.filters);
  const sortMode = asSortMode(input.sortMode);
  const durationDays = Math.max(1, Math.min(365, Math.floor(Number(input.durationDays) || 14)));

  const campaign = await prisma.campaign.create({
    data: {
      name,
      label: campaignLabelFromName(name),
      description: input.description?.trim() || null,
      status: CampaignStatus.DRAFT,
      filters: filters as Prisma.InputJsonValue,
      sortMode,
      durationDays,
      createdById: input.adminId,
      members: allocations.length
        ? {
            create: allocations.map((row) => ({
              userId: row.userId,
              targetCount: row.count,
              dailyContactGoal: row.dailyContactGoal || 0
            }))
          }
        : undefined
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      createdBy: { select: { id: true, name: true, email: true } }
    }
  });

  return { status: "ok" as const, campaign };
}

export async function updateCampaignMeta(input: {
  campaignId: string;
  name?: string;
  label?: string | null;
  description?: string | null;
  status?: "DRAFT" | "ACTIVE" | "PAUSED" | "CLOSED";
}) {
  const existing = await prisma.campaign.findUnique({ where: { id: input.campaignId }, select: { id: true, status: true } });
  if (!existing) return { status: "not-found" as const };

  if (input.status === "ACTIVE" && existing.status === CampaignStatus.DRAFT) {
    return { status: "invalid" as const, message: "Launch the campaign to activate it" };
  }
  if (input.status === "ACTIVE" && existing.status !== CampaignStatus.PAUSED && existing.status !== CampaignStatus.ACTIVE) {
    return { status: "invalid" as const, message: "Only paused campaigns can be resumed" };
  }

  const nextStatus = input.status as CampaignStatus | undefined;
  const nextName = input.name != null ? input.name.trim() : undefined;
  const campaign = await prisma.campaign.update({
    where: { id: input.campaignId },
    data: {
      ...(nextName != null
        ? {
            name: nextName,
            label: campaignLabelFromName(nextName)
          }
        : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(nextStatus
        ? {
            status: nextStatus,
            closedAt: nextStatus === CampaignStatus.CLOSED ? new Date() : null
          }
        : {})
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { leads: true } }
    }
  });

  return { status: "ok" as const, campaign };
}

async function materializeCandidate(input: {
  candidate: CampaignCandidate;
  adminId: string;
  salesUserId: string;
  campaignId: string;
}) {
  const indexed = await prisma.leadPhoneIndex.findUnique({
    where: { phoneKey: input.candidate.phoneKey }
  });

  if (indexed) {
    if (indexed.kind === "LOCAL") {
      const existing = await prisma.lead.findUnique({
        where: { id: indexed.leadId },
        select: { id: true, claimedById: true, phase: true }
      });
      if (!existing) return { status: "skipped-error" as const, reason: "missing-local" };
      if (existing.phase !== LeadPhase.NEW) return { status: "skipped-worked" as const };
      if (existing.claimedById && existing.claimedById !== input.salesUserId) {
        return { status: "skipped-claimed" as const };
      }
      if (!existing.claimedById) {
        await setLeadClaim({ leadId: existing.id, adminId: input.adminId, salesUserId: input.salesUserId });
      }
      return { status: "ok" as const, leadId: existing.id, leadKind: "LOCAL" as const };
    }

    const existing = await prisma.registryLead.findUnique({
      where: { id: indexed.leadId },
      select: { id: true, claimedById: true, phase: true }
    });
    if (!existing) return { status: "skipped-error" as const, reason: "missing-registry" };
    if (existing.phase !== LeadPhase.NEW) return { status: "skipped-worked" as const };
    if (existing.claimedById && existing.claimedById !== input.salesUserId) {
      return { status: "skipped-claimed" as const };
    }
    if (!existing.claimedById) {
      await setLeadClaim({ leadId: existing.id, adminId: input.adminId, salesUserId: input.salesUserId });
    }
    return { status: "ok" as const, leadId: existing.id, leadKind: "REGISTRY" as const };
  }

  if (!input.candidate.mongoBusinessId) {
    return { status: "skipped-no-mongo" as const };
  }

  const created = await claimRegistryLead({
    mongoBusinessId: input.candidate.mongoBusinessId,
    phoneKey: input.candidate.phoneKey,
    actorId: input.adminId,
    createdById: input.adminId,
    claimedById: input.salesUserId,
    claimActor: true,
    metadata: { source: "campaign", campaignId: input.campaignId },
    snapshot: {
      fullName: input.candidate.fullName,
      phoneNumber: input.candidate.phoneNumber,
      region: input.candidate.region,
      subcity: input.candidate.subcity
    }
  });

  if (created.status === "ok") {
    return { status: "ok" as const, leadId: created.lead.id, leadKind: "REGISTRY" as const };
  }
  if (created.status === "duplicate" && created.duplicate) {
    const dup = created.duplicate;
    if (dup.claimedById && dup.claimedById !== input.salesUserId) {
      return { status: "skipped-claimed" as const };
    }
    if (!dup.claimedById) {
      await setLeadClaim({ leadId: dup.id, adminId: input.adminId, salesUserId: input.salesUserId });
    }
    return { status: "ok" as const, leadId: dup.id, leadKind: "REGISTRY" as const };
  }
  return { status: "skipped-error" as const, reason: created.status };
}

/**
 * Select Mongo leads matching filters, materialize + assign to sales agents,
 * and snapshot them onto the campaign.
 */
export async function launchCampaign(input: LaunchCampaignInput) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    include: { members: true, _count: { select: { leads: true } } }
  });
  if (!campaign) return { status: "not-found" as const };
  if (campaign.status === CampaignStatus.CLOSED) {
    return { status: "invalid" as const, message: "Closed campaigns cannot be launched again" };
  }
  if (campaign._count.leads > 0 && campaign.status === CampaignStatus.ACTIVE) {
    return { status: "invalid" as const, message: "Campaign already has assigned leads" };
  }

  const finalAllocations = normalizeAllocations(
    input.allocations?.length
      ? input.allocations
      : campaign.members.map((m) => ({
          userId: m.userId,
          count: m.targetCount,
          dailyContactGoal: m.dailyContactGoal
        }))
  );

  if (!finalAllocations.length) {
    return { status: "invalid" as const, message: "Add at least one sales agent with a lead count" };
  }

  const totalRequested = finalAllocations.reduce((sum, a) => sum + a.count, 0);

  const salesUsers = await prisma.user.findMany({
    where: { id: { in: finalAllocations.map((a) => a.userId) }, role: "SALES" },
    select: { id: true }
  });
  if (salesUsers.length !== finalAllocations.length) {
    return { status: "invalid" as const, message: "One or more sales users are invalid" };
  }

  const filters = asFilters(input.filters ?? campaign.filters);
  const sortMode = asSortMode(input.sortMode ?? campaign.sortMode);

  // Prefer a prepared unique-phone pool from step 2 (draft CampaignLead rows, unassigned).
  const preparedPool = await prisma.campaignLead.findMany({
    where: { campaignId: campaign.id, assignedToId: null },
    orderBy: [{ capital: "desc" }, { fullName: "asc" }]
  });

  let poolCandidates: CampaignCandidate[] = [];
  let scannedBusinesses = 0;
  let poolExhausted = false;

  if (preparedPool.length) {
    poolCandidates = preparedPool.map((row) => ({
      mongoBusinessId: row.externalBusinessId || "",
      phoneKey: row.phoneKey,
      phoneNumber: row.phoneNumber,
      fullName: row.fullName,
      businessName: row.businessName || "",
      capital: row.capital || 0,
      value: 0,
      region: row.region || "",
      subcity: row.subcity || ""
    }));
    poolExhausted = preparedPool.length < totalRequested;
  } else {
    // Fallback: live directory select (legacy / draft without prepare step)
    const excludePhoneKeys = await getExcludedPhoneKeys();
    const existingOnCampaign = await prisma.campaignLead.findMany({
      where: { campaignId: campaign.id },
      select: { phoneKey: true }
    });
    for (const row of existingOnCampaign) excludePhoneKeys.add(row.phoneKey);

    try {
      const selection = await selectForCampaign({
        filters,
        sortMode,
        limit: totalRequested,
        excludePhoneKeys
      });
      poolCandidates = selection.candidates;
      scannedBusinesses = selection.scannedBusinesses;
      poolExhausted = selection.exhausted;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to select leads from directory";
      const timedOut =
        (error as { code?: string })?.code === "CAMPAIGN_SELECT_TIMEOUT" ||
        message.includes("timed out") ||
        message.includes("operation exceeded time limit");
      return {
        status: "invalid" as const,
        message: timedOut
          ? "Directory search timed out. Narrow your filters (region, sector, or capital range) and try again."
          : message
      };
    }
  }

  if (!poolCandidates.length) {
    return {
      status: "empty" as const,
      message: preparedPool.length
        ? "Prepared pool is empty. Go back to Filters and prepare a pool first."
        : "No eligible leads matched your filters (worked/claimed/active-campaign phones are excluded)"
    };
  }

  if (totalRequested > poolCandidates.length) {
    return {
      status: "invalid" as const,
      message: `Requested ${totalRequested} leads but pool only has ${poolCandidates.length}. Lower agent counts or prepare a larger pool.`
    };
  }

  // Build assignment queue: fill agents in order of allocation from the prepared pool
  const queue: { candidate: CampaignCandidate; salesUserId: string; poolRowId?: string }[] = [];
  let cursor = 0;
  for (const alloc of finalAllocations) {
    for (let i = 0; i < alloc.count && cursor < poolCandidates.length; i += 1) {
      queue.push({
        candidate: poolCandidates[cursor]!,
        salesUserId: alloc.userId,
        poolRowId: preparedPool[cursor]?.id
      });
      cursor += 1;
    }
  }

  const results = {
    assigned: 0,
    skippedWorked: 0,
    skippedClaimed: 0,
    skippedError: 0,
    requested: totalRequested,
    matched: poolCandidates.length
  };

  const now = new Date();

  // Bulk materialize registry shells for unassigned phones (fast path).
  const phoneKeys = queue.map((item) => item.candidate.phoneKey);
  const existingIndex = phoneKeys.length
    ? await prisma.leadPhoneIndex.findMany({ where: { phoneKey: { in: phoneKeys } } })
    : [];
  const indexByPhone = new Map(existingIndex.map((row) => [row.phoneKey, row]));

  const toCreate = queue.filter((item) => !indexByPhone.has(item.candidate.phoneKey) && item.candidate.mongoBusinessId);
  if (toCreate.length) {
    await prisma.registryLead.createMany({
      data: toCreate.map((item) => ({
        externalBusinessId: item.candidate.mongoBusinessId,
        phoneKey: item.candidate.phoneKey,
        phoneNumber: item.candidate.phoneNumber,
        displayName: item.candidate.fullName || item.candidate.phoneNumber || "Registry lead",
        regionKey: item.candidate.region || null,
        subcityKey: item.candidate.subcity || null,
        sectorKey: null,
        createdById: input.adminId,
        claimedById: item.salesUserId,
        claimedAt: now,
        phase: LeadPhase.NEW
      })),
      skipDuplicates: true
    });
    const createdShells = await prisma.registryLead.findMany({
      where: { phoneKey: { in: toCreate.map((item) => item.candidate.phoneKey) } },
      select: { id: true, phoneKey: true }
    });
    if (createdShells.length) {
      await prisma.leadPhoneIndex.createMany({
        data: createdShells.map((row) => ({
          phoneKey: row.phoneKey,
          kind: LeadKind.REGISTRY,
          leadId: row.id
        })),
        skipDuplicates: true
      });
      await prisma.activityEvent.createMany({
        data: createdShells.flatMap((row) => {
          const owner = toCreate.find((item) => item.candidate.phoneKey === row.phoneKey)?.salesUserId;
          return [
            {
              actorId: input.adminId,
              leadKind: LeadKind.REGISTRY,
              leadId: row.id,
              type: ActivityType.LEAD_CREATED,
              metadata: { source: "campaign", campaignId: campaign.id, claimedOnCreate: true }
            },
            {
              actorId: input.adminId,
              leadKind: LeadKind.REGISTRY,
              leadId: row.id,
              type: ActivityType.LEAD_CLAIMED,
              metadata: { claimedById: owner, source: "campaign", campaignId: campaign.id }
            }
          ];
        })
      });
      for (const row of createdShells) {
        indexByPhone.set(row.phoneKey, { phoneKey: row.phoneKey, kind: LeadKind.REGISTRY, leadId: row.id });
      }
    }
  }

  // Resolve each queue item to a lead id (bulk-created shells already claimed to the right agent).
  const assignmentUpdates: { poolRowId?: string; phoneKey: string; leadId: string; leadKind: LeadKind; salesUserId: string }[] =
    [];
  const justCreatedPhones = new Set(toCreate.map((item) => item.candidate.phoneKey));

  for (const item of queue) {
    const indexed = indexByPhone.get(item.candidate.phoneKey);
    if (!indexed) {
      const outcome = await materializeCandidate({
        candidate: item.candidate,
        adminId: input.adminId,
        salesUserId: item.salesUserId,
        campaignId: campaign.id
      });
      if (outcome.status !== "ok") {
        if (outcome.status === "skipped-worked") results.skippedWorked += 1;
        else if (outcome.status === "skipped-claimed") results.skippedClaimed += 1;
        else results.skippedError += 1;
        continue;
      }
      assignmentUpdates.push({
        poolRowId: item.poolRowId,
        phoneKey: item.candidate.phoneKey,
        leadId: outcome.leadId,
        leadKind: outcome.leadKind === "LOCAL" ? LeadKind.LOCAL : LeadKind.REGISTRY,
        salesUserId: item.salesUserId
      });
      results.assigned += 1;
      continue;
    }

    if (indexed.kind === LeadKind.LOCAL) {
      const existing = await prisma.lead.findUnique({
        where: { id: indexed.leadId },
        select: { id: true, claimedById: true, phase: true }
      });
      if (!existing || existing.phase !== LeadPhase.NEW) {
        results.skippedWorked += 1;
        continue;
      }
      if (existing.claimedById && existing.claimedById !== item.salesUserId) {
        results.skippedClaimed += 1;
        continue;
      }
      if (!existing.claimedById) {
        await setLeadClaim({ leadId: existing.id, adminId: input.adminId, salesUserId: item.salesUserId });
      }
      assignmentUpdates.push({
        poolRowId: item.poolRowId,
        phoneKey: item.candidate.phoneKey,
        leadId: existing.id,
        leadKind: LeadKind.LOCAL,
        salesUserId: item.salesUserId
      });
      results.assigned += 1;
      continue;
    }

    // Fresh bulk-created registry shells are already claimed to the agent.
    if (justCreatedPhones.has(item.candidate.phoneKey)) {
      assignmentUpdates.push({
        poolRowId: item.poolRowId,
        phoneKey: item.candidate.phoneKey,
        leadId: indexed.leadId,
        leadKind: LeadKind.REGISTRY,
        salesUserId: item.salesUserId
      });
      results.assigned += 1;
      continue;
    }

    const shell = await prisma.registryLead.findUnique({
      where: { id: indexed.leadId },
      select: { id: true, claimedById: true, phase: true }
    });
    if (!shell || shell.phase !== LeadPhase.NEW) {
      results.skippedWorked += 1;
      continue;
    }
    if (shell.claimedById && shell.claimedById !== item.salesUserId) {
      results.skippedClaimed += 1;
      continue;
    }
    if (!shell.claimedById || shell.claimedById !== item.salesUserId) {
      await prisma.registryLead.update({
        where: { id: shell.id },
        data: { claimedById: item.salesUserId, claimedAt: now }
      });
    }
    assignmentUpdates.push({
      poolRowId: item.poolRowId,
      phoneKey: item.candidate.phoneKey,
      leadId: shell.id,
      leadKind: LeadKind.REGISTRY,
      salesUserId: item.salesUserId
    });
    results.assigned += 1;
  }

  if (!assignmentUpdates.length) {
    return {
      status: "empty" as const,
      message: "Matched leads could not be assigned (already claimed or worked)",
      results
    };
  }

  const stillThere = await prisma.campaign.findUnique({
    where: { id: campaign.id },
    select: { id: true, durationDays: true }
  });
  if (!stillThere) return { status: "not-found" as const };

  await prisma.$transaction(
    async (db) => {
      await db.campaignMember.deleteMany({ where: { campaignId: campaign.id } });
      await db.campaignMember.createMany({
        data: finalAllocations.map((row) => ({
          campaignId: campaign.id,
          userId: row.userId,
          targetCount: row.count,
          dailyContactGoal: row.dailyContactGoal || 0
        }))
      });

      // Drop unused prepared pool rows (not assigned this launch)
      const assignedPhones = new Set(assignmentUpdates.map((row) => row.phoneKey));
      await db.campaignLead.deleteMany({
        where: {
          campaignId: campaign.id,
          phoneKey: { notIn: [...assignedPhones] }
        }
      });

      for (const row of assignmentUpdates) {
        if (row.poolRowId) {
          await db.campaignLead.update({
            where: { id: row.poolRowId },
            data: {
              leadKind: row.leadKind,
              leadId: row.leadId,
              assignedToId: row.salesUserId,
              assignedAt: now
            }
          });
        } else {
          const cand = queue.find((q) => q.candidate.phoneKey === row.phoneKey)?.candidate;
          await db.campaignLead.upsert({
            where: { campaignId_phoneKey: { campaignId: campaign.id, phoneKey: row.phoneKey } },
            create: {
              campaignId: campaign.id,
              phoneKey: row.phoneKey,
              phoneNumber: cand?.phoneNumber || "",
              externalBusinessId: cand?.mongoBusinessId || null,
              fullName: cand?.fullName || "Lead",
              businessName: cand?.businessName || null,
              capital: cand?.capital ?? null,
              region: cand?.region || null,
              subcity: cand?.subcity || null,
              leadKind: row.leadKind,
              leadId: row.leadId,
              assignedToId: row.salesUserId,
              assignedAt: now
            },
            update: {
              leadKind: row.leadKind,
              leadId: row.leadId,
              assignedToId: row.salesUserId,
              assignedAt: now
            }
          });
        }
      }

      const endsAt = new Date(now.getTime() + stillThere.durationDays * 86_400_000);
      await db.campaign.update({
        where: { id: campaign.id },
        data: {
          status: CampaignStatus.ACTIVE,
          filters: filters as Prisma.InputJsonValue,
          sortMode,
          assignedAt: now,
          startsAt: now,
          endsAt
        }
      });
    },
    { timeout: 120_000, maxWait: 15_000 }
  );

  const detail = await import("./campaignQueries.js").then((m) => m.getCampaignDetail(campaign.id));
  const underfilled = results.assigned < results.requested;
  return {
    status: "ok" as const,
    campaign: detail,
    results: {
      ...results,
      scannedBusinesses,
      poolExhausted
    },
    message: underfilled
      ? `Only assigned ${results.assigned} of ${results.requested} requested leads.`
      : undefined
  };
}

export async function deleteDraftCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, status: true, _count: { select: { leads: true } } }
  });
  if (!campaign) return { status: "not-found" as const };
  if (campaign.status !== CampaignStatus.DRAFT || campaign._count.leads > 0) {
    return { status: "invalid" as const, message: "Only empty draft campaigns can be deleted" };
  }
  await prisma.campaign.delete({ where: { id: campaignId } });
  return { status: "ok" as const };
}
