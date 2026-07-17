import { ObjectId } from "mongodb";
import { ActivityType, LeadKind } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ensureBusinessesIndexes, getBusinessesCollection } from "../../config/mongo.js";
import { phoneKey } from "../leads/leadService.js";
import { findPhoneOwner, registryLeadInclude, reservePhone } from "../leads/leadIdentity.js";
import { getLeadViewById, registryLeadToView, type LeadView } from "../leads/leadView.js";
import type { DirectoryRow, MongoBusinessDoc, MongoBusinessSector, RegistryFilters, RegistryLead } from "./registryTypes.js";

const QUERY_MAX_MS = 20_000;
/** Campaign selection scans/sorts more docs than list views; allow longer on remote Mongo. */
const CAMPAIGN_QUERY_MAX_MS = 120_000;
const CAMPAIGN_LEAD_CAP = 500;
let filterOptionsCache: { value: Awaited<ReturnType<typeof loadRegistryFilterOptions>>; expiresAt: number } | null =
  null;
let localLeadFilterOptionsCache: {
  value: Awaited<ReturnType<typeof listLocalLeadFilterOptionsUncached>>;
  expiresAt: number;
} | null = null;

function str(value: unknown) {
  return String(value ?? "").trim();
}

/** Normalize legacy string or string[] sector filters to a clean string[]. */
export function normalizeSectorFilter(sector: unknown): string[] {
  if (Array.isArray(sector)) {
    return [...new Set(sector.map((item) => str(item)).filter(Boolean))];
  }
  const single = str(sector);
  return single ? [single] : [];
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function tryPhoneKey(value: string) {
  try {
    return phoneKey(value);
  } catch {
    return null;
  }
}

function sectorPhone(sector: MongoBusinessSector) {
  return str(sector.managerPhone) || str(sector.businessNumber);
}

function asBusiness(doc: unknown): MongoBusinessDoc {
  return doc as MongoBusinessDoc;
}

function displayName(business: MongoBusinessDoc, sectorPhoneValue: string) {
  const manager = [str(business.managerFirstName), str(business.managerLastName)].filter(Boolean).join(" ");
  return str(business.businessName) || manager || sectorPhoneValue || "Registry lead";
}

export function flattenBusinessToRegistryLeads(business: MongoBusinessDoc): Omit<
  RegistryLead,
  "crmLeadId" | "crmPhase" | "claimedById" | "claimedByName" | "inCrm"
>[] {
  const mongoBusinessId = business._id.toString();
  const seen = new Set<string>();
  const rows: Omit<RegistryLead, "crmLeadId" | "crmPhase" | "claimedById" | "claimedByName" | "inCrm">[] = [];

  for (const sector of business.businessSectors || []) {
    const phoneNumber = sectorPhone(sector);
    if (!phoneNumber) continue;
    const key = tryPhoneKey(phoneNumber);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    rows.push({
      mongoBusinessId,
      tin: str(business.tin),
      phoneNumber,
      phoneKey: key,
      fullName: displayName(business, phoneNumber),
      businessName: str(business.businessName),
      businessType: str(business.businessType),
      capital: num(business.capital),
      value: num(business.value),
      nationality: str(business.nationality),
      managerFirstName: str(business.managerFirstName),
      managerLastName: str(business.managerLastName),
      dateRegistered: str(sector.dateRegistered),
      sector: str(sector.sector),
      sectorCategory: str(sector.englishDescription),
      region: str(sector.region),
      subcity: str(sector.subcity),
      managerPhone: str(sector.managerPhone),
      businessNumber: str(sector.businessNumber)
    });
  }

  return rows;
}

function hasPhoneClause() {
  return {
    $or: [
      { "businessSectors.managerPhone": { $gt: "" } },
      { "businessSectors.businessNumber": { $gt: "" } }
    ]
  };
}

export function buildMongoFilter(
  filters: RegistryFilters,
  options: { requirePhone?: boolean } = {}
): Record<string, unknown> {
  const requirePhone = options.requirePhone !== false;
  const and: Record<string, unknown>[] = requirePhone ? [hasPhoneClause()] : [];
  const sectorMatch: Record<string, unknown> = {};

  if (filters.region?.trim()) sectorMatch.region = filters.region.trim();
  if (filters.subcity?.trim()) sectorMatch.subcity = filters.subcity.trim();
  const sectors = normalizeSectorFilter(filters.sector);
  if (sectors.length === 1) sectorMatch.englishDescription = sectors[0];
  else if (sectors.length > 1) sectorMatch.englishDescription = { $in: sectors };

  if (Object.keys(sectorMatch).length) {
    and.push({ businessSectors: { $elemMatch: sectorMatch } });
  }

  if (filters.nationality?.trim()) and.push({ nationality: filters.nationality.trim() });
  if (filters.businessType?.trim()) and.push({ businessType: filters.businessType.trim() });

  const capital: Record<string, number> = {};
  if (filters.capitalMin != null && Number.isFinite(filters.capitalMin)) capital.$gte = filters.capitalMin;
  if (filters.capitalMax != null && Number.isFinite(filters.capitalMax)) capital.$lte = filters.capitalMax;
  if (Object.keys(capital).length) and.push({ capital });

  const value: Record<string, number> = {};
  if (filters.scoreMin != null && Number.isFinite(filters.scoreMin)) value.$gte = filters.scoreMin;
  if (filters.scoreMax != null && Number.isFinite(filters.scoreMax)) value.$lte = filters.scoreMax;
  if (Object.keys(value).length) and.push({ value });

  const search = filters.search?.trim();
  if (search) {
    const digits = search.replace(/\D/g, "");
    if (digits && digits === search.replace(/\s/g, "")) {
      and.push({ tin: { $regex: `^${digits}` } });
    } else {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      and.push({
        $or: [
          { businessName: { $regex: escaped, $options: "i" } },
          { managerFirstName: { $regex: escaped, $options: "i" } },
          { managerLastName: { $regex: escaped, $options: "i" } }
        ]
      });
    }
  }

  if (!and.length) return {};
  return and.length === 1 ? and[0]! : { $and: and };
}

function isMaxTimeError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: number; codeName?: string; message?: string };
  return (
    err.code === 50 ||
    err.codeName === "MaxTimeMSExpired" ||
    String(err.message || "").includes("operation exceeded time limit")
  );
}

function matchesSectorFilters(
  row: ReturnType<typeof flattenBusinessToRegistryLeads>[number],
  filters: RegistryFilters
) {
  if (filters.region?.trim() && row.region !== filters.region.trim()) return false;
  if (filters.subcity?.trim() && row.subcity !== filters.subcity.trim()) return false;
  const sectors = normalizeSectorFilter(filters.sector);
  if (sectors.length) {
    const category = row.sectorCategory.toLowerCase();
    if (!sectors.some((item) => item.toLowerCase() === category)) return false;
  }
  return true;
}

async function annotateCrmStatus(
  rows: Omit<DirectoryRow, "crmLeadId" | "crmPhase" | "claimedById" | "claimedByName" | "inCrm">[]
): Promise<DirectoryRow[]> {
  if (!rows.length) return [];
  const phoneKeys = [...new Set(rows.map((row) => row.phoneKey))];
  const indexRows = await prisma.leadPhoneIndex.findMany({
    where: { phoneKey: { in: phoneKeys } },
    select: { phoneKey: true, kind: true, leadId: true }
  });
  const localIds = indexRows.filter((r) => r.kind === LeadKind.LOCAL).map((r) => r.leadId);
  const regIds = indexRows.filter((r) => r.kind === LeadKind.REGISTRY).map((r) => r.leadId);
  const [locals, regs] = await Promise.all([
    localIds.length
      ? prisma.lead.findMany({
          where: { id: { in: localIds } },
          select: { id: true, phoneKey: true, phase: true, claimedById: true, claimedBy: { select: { name: true } } }
        })
      : [],
    regIds.length
      ? prisma.registryLead.findMany({
          where: { id: { in: regIds } },
          select: { id: true, phoneKey: true, phase: true, claimedById: true, claimedBy: { select: { name: true } } }
        })
      : []
  ]);
  const byPhone = new Map<string, { id: string; phase: string; claimedById: string | null; claimedByName: string | null }>();
  for (const lead of locals) {
    byPhone.set(lead.phoneKey, {
      id: lead.id,
      phase: lead.phase,
      claimedById: lead.claimedById,
      claimedByName: lead.claimedBy?.name ?? null
    });
  }
  for (const lead of regs) {
    byPhone.set(lead.phoneKey, {
      id: lead.id,
      phase: lead.phase,
      claimedById: lead.claimedById,
      claimedByName: lead.claimedBy?.name ?? null
    });
  }

  return rows.map((row) => {
    const crm = byPhone.get(row.phoneKey);
    return {
      ...row,
      externalBusinessId: row.mongoBusinessId,
      crmLeadId: crm?.id ?? null,
      crmPhase: crm?.phase ?? null,
      claimedById: crm?.claimedById ?? null,
      claimedByName: crm?.claimedByName ?? null,
      inCrm: Boolean(crm)
    };
  });
}

export async function listRegistryLeads(filters: RegistryFilters = {}) {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 50));
  const collection = await getBusinessesCollection();
  const query = buildMongoFilter(filters);

  const findCursor = collection
    .find(query)
    .maxTimeMS(QUERY_MAX_MS)
    .sort({ capital: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .project({
      tin: 1,
      businessName: 1,
      businessType: 1,
      capital: 1,
      value: 1,
      nationality: 1,
      managerFirstName: 1,
      managerLastName: 1,
      businessSectors: 1
    });

  const rawBusinesses = await findCursor.toArray();

  let totalBusinesses = rawBusinesses.length + (page - 1) * pageSize;
  try {
    // Unfiltered list still has the "has phone" clause — estimated total is fine for scale.
    const onlyPhoneFilter = JSON.stringify(query) === JSON.stringify(hasPhoneClause());
    totalBusinesses = onlyPhoneFilter
      ? await collection.estimatedDocumentCount()
      : await collection.countDocuments(query, { maxTimeMS: QUERY_MAX_MS });
  } catch {
    // Keep approximate total when count is too expensive/slow.
    if (rawBusinesses.length === pageSize) totalBusinesses = page * pageSize + 1;
  }

  const flattened = rawBusinesses.flatMap((business) =>
    flattenBusinessToRegistryLeads(asBusiness(business)).filter((row) => matchesSectorFilters(row, filters))
  );
  const leads = await annotateCrmStatus(flattened);

  return {
    leads,
    pagination: {
      page,
      pageSize,
      total: totalBusinesses,
      totalPages: Math.max(1, Math.ceil(totalBusinesses / pageSize)),
      note: "Pagination is by business document; each row is a sector phone lead"
    }
  };
}

async function distinctSafe(
  collection: Awaited<ReturnType<typeof getBusinessesCollection>>,
  field: string,
  maxTimeMS = QUERY_MAX_MS
) {
  try {
    return await collection.distinct(field, {}, { maxTimeMS });
  } catch {
    return [] as unknown[];
  }
}

/** Nested englishDescription distinct times out on full collection; sample is reliable enough for UI. */
async function loadSectorLabels(collection: Awaited<ReturnType<typeof getBusinessesCollection>>) {
  try {
    const rows = await collection
      .aggregate<{ _id: string }>(
        [
          { $sample: { size: 12_000 } },
          { $project: { s: "$businessSectors.englishDescription" } },
          { $unwind: "$s" },
          { $match: { s: { $type: "string", $ne: "" } } },
          { $group: { _id: "$s" } },
          { $sort: { _id: 1 } },
          { $limit: 500 }
        ],
        { maxTimeMS: 35_000, allowDiskUse: true }
      )
      .toArray();
    const labels = rows.map((row) => str(row._id)).filter(Boolean);
    if (labels.length) return labels;
  } catch {
    /* fall through */
  }

  try {
    const values = await collection.distinct("businessSectors.englishDescription", {}, { maxTimeMS: 45_000 });
    return values.map((value) => str(value)).filter(Boolean);
  } catch {
    return [];
  }
}

async function loadRegistryFilterOptions() {
  const collection = await getBusinessesCollection();

  const [regions, subcities, sectors, nationalities, businessTypes] = await Promise.all([
    distinctSafe(collection, "businessSectors.region"),
    distinctSafe(collection, "businessSectors.subcity"),
    loadSectorLabels(collection),
    distinctSafe(collection, "nationality"),
    distinctSafe(collection, "businessType")
  ]);

  const clean = (values: unknown[]) =>
    values
      .map((value) => str(value))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

  return {
    regions: clean(regions),
    subcities: clean(subcities),
    sectors: clean(sectors).slice(0, 500),
    nationalities: clean(nationalities),
    businessTypes: clean(businessTypes)
  };
}

export async function getRegistryFilterOptions() {
  if (filterOptionsCache && filterOptionsCache.expiresAt > Date.now()) {
    return filterOptionsCache.value;
  }
  const value = await loadRegistryFilterOptions();
  // Empty sectors usually mean a timeout — retry soon instead of caching failure for 10m.
  const ttl = value.sectors.length ? 10 * 60_000 : 30_000;
  filterOptionsCache = { value, expiresAt: Date.now() + ttl };
  return value;
}

export async function getMongoBusinessById(mongoBusinessId: string): Promise<MongoBusinessDoc | null> {
  const collection = await getBusinessesCollection();
  if (!ObjectId.isValid(mongoBusinessId)) return null;
  const doc = await collection.findOne({ _id: new ObjectId(mongoBusinessId) });
  return doc ? asBusiness(doc) : null;
}

export async function claimRegistryLead(input: {
  mongoBusinessId: string;
  phoneNumber?: string;
  phoneKey?: string;
  actorId: string;
  claimActor?: boolean;
  /** When set, overrides who owns the lead after materialize (campaign assign). */
  claimedById?: string | null;
  createdById?: string;
  metadata?: Record<string, unknown>;
  /** Optional preloaded directory fields — skips directory re-fetch when set. */
  snapshot?: {
    fullName: string;
    phoneNumber: string;
    region?: string;
    subcity?: string;
    sectorCategory?: string;
  };
}) {
  const claimActor = input.claimActor !== false;
  const ownerId = input.claimedById !== undefined ? input.claimedById : claimActor ? input.actorId : null;
  const creatorId = input.createdById || input.actorId;
  const key =
    (input.phoneKey?.replace(/\D/g, "") || null) ||
    (input.phoneNumber ? tryPhoneKey(input.phoneNumber) : null);
  if (!key) return { status: "invalid-phone" as const };

  let displayName = input.snapshot?.fullName?.trim() || "";
  let phoneNumber = input.snapshot?.phoneNumber?.trim() || input.phoneNumber?.trim() || "";
  let regionKey = input.snapshot?.region?.trim() || null;
  let subcityKey = input.snapshot?.subcity?.trim() || null;
  let sectorKey = input.snapshot?.sectorCategory?.trim() || null;

  if (!displayName || !phoneNumber || !regionKey) {
    const business = await getMongoBusinessById(input.mongoBusinessId);
    if (!business) return { status: "not-found" as const };
    const candidates = flattenBusinessToRegistryLeads(business);
    const sectorMatch = candidates.find((row) => row.phoneKey === key);
    if (!sectorMatch) return { status: "phone-not-on-business" as const };
    displayName = sectorMatch.fullName;
    phoneNumber = sectorMatch.phoneNumber;
    regionKey = sectorMatch.region || null;
    subcityKey = sectorMatch.subcity || null;
    sectorKey = sectorMatch.sectorCategory || null;
  }

  return prisma.$transaction(async (db) => {
    const existingIndex = await db.leadPhoneIndex.findUnique({ where: { phoneKey: key } });
    if (existingIndex) {
      if (existingIndex.kind === LeadKind.REGISTRY) {
        const duplicate = await db.registryLead.findUnique({
          where: { id: existingIndex.leadId },
          select: { id: true, phoneNumber: true, displayName: true, claimedById: true }
        });
        if (duplicate) {
          return {
            status: "duplicate" as const,
            duplicate: {
              id: duplicate.id,
              fullName: duplicate.displayName,
              phoneNumber: duplicate.phoneNumber,
              licenceNumber: null,
              claimedById: duplicate.claimedById
            }
          };
        }
      } else {
        const duplicate = await db.lead.findUnique({
          where: { id: existingIndex.leadId },
          select: { id: true, fullName: true, phoneNumber: true, licenceNumber: true, claimedById: true }
        });
        if (duplicate) return { status: "duplicate" as const, duplicate };
      }
    }

    const now = new Date();
    const shell = await db.registryLead.create({
      data: {
        externalBusinessId: input.mongoBusinessId,
        phoneKey: key,
        phoneNumber,
        displayName: displayName || phoneNumber || "Registry lead",
        regionKey,
        subcityKey,
        sectorKey,
        createdById: creatorId,
        claimedById: ownerId,
        claimedAt: ownerId ? now : null
      },
      include: registryLeadInclude
    });
    await reservePhone(db, { phoneKey: key, kind: LeadKind.REGISTRY, leadId: shell.id });
    await db.activityEvent.create({
      data: {
        actorId: input.actorId,
        leadKind: LeadKind.REGISTRY,
        leadId: shell.id,
        type: ActivityType.LEAD_CREATED,
        metadata: {
          source: "registry",
          externalBusinessId: input.mongoBusinessId,
          claimedOnCreate: Boolean(ownerId),
          ...(input.metadata || {})
        }
      }
    });
    if (ownerId) {
      await db.activityEvent.create({
        data: {
          actorId: input.actorId,
          leadKind: LeadKind.REGISTRY,
          leadId: shell.id,
          type: ActivityType.LEAD_CLAIMED,
          metadata: { claimedById: ownerId, ...(input.metadata || {}) }
        }
      });
    }
    const view = registryLeadToView(shell);
    return { status: "ok" as const, lead: view };
  });
}

export type CampaignSortMode = "capital_desc" | "capital_asc" | "value_desc" | "value_asc" | "random";

export type CampaignCandidate = {
  mongoBusinessId: string;
  phoneKey: string;
  phoneNumber: string;
  fullName: string;
  businessName: string;
  capital: number;
  value: number;
  region: string;
  subcity: string;
};

/**
 * Pull eligible directory phone-leads for campaign assignment.
 * Skips phones in `excludePhoneKeys` (already worked / claimed / in active campaigns).
 *
 * Streams businesses until `limit` phones are filled (or hard scan cap). A tight
 * pre-limit (e.g. 750 docs) under-fills badly when many rows lack phones or are excluded.
 */
export async function selectRegistryLeadsForCampaign(input: {
  filters: RegistryFilters;
  sortMode: CampaignSortMode;
  limit: number;
  excludePhoneKeys: Set<string>;
  /** Max business docs to scan when filling the pool (safety). */
  maxScan?: number;
}): Promise<{ candidates: CampaignCandidate[]; scannedBusinesses: number; exhausted: boolean }> {
  const limit = Math.max(0, Math.min(CAMPAIGN_LEAD_CAP, input.limit));
  if (!limit) return { candidates: [], scannedBusinesses: 0, exhausted: true };

  // Prefer capital/value indexes for sort+limit campaign scans.
  await ensureBusinessesIndexes();
  const collection = await getBusinessesCollection();
  // No requirePhone in Mongo — nested $or on array fields is a frequent full-scan killer.
  const query = buildMongoFilter(input.filters, { requirePhone: false });
  // Exclusion density can be high; scan well beyond limit. Cap keeps remote Mongo bounded.
  const maxScan = Math.max(
    limit,
    Math.min(input.maxScan ?? Math.max(limit * 12, 2_000), 12_000)
  );
  const projection = {
    tin: 1,
    businessName: 1,
    businessType: 1,
    capital: 1,
    value: 1,
    nationality: 1,
    managerFirstName: 1,
    managerLastName: 1,
    businessSectors: 1
  };
  /** Larger pages = fewer network round-trips than cursor.next() one doc at a time. */
  const PAGE_SIZE = 400;

  const candidates: CampaignCandidate[] = [];
  const seenPhones = new Set<string>();
  let scannedBusinesses = 0;
  let exhausted = false;

  const pushFromBusiness = (doc: unknown) => {
    const business = asBusiness(doc);
    const rows = flattenBusinessToRegistryLeads(business).filter((row) =>
      matchesSectorFilters(row, input.filters)
    );
    for (const row of rows) {
      if (input.excludePhoneKeys.has(row.phoneKey) || seenPhones.has(row.phoneKey)) continue;
      seenPhones.add(row.phoneKey);
      candidates.push({
        mongoBusinessId: row.mongoBusinessId,
        phoneKey: row.phoneKey,
        phoneNumber: row.phoneNumber,
        fullName: row.fullName,
        businessName: row.businessName,
        capital: row.capital,
        value: row.value,
        region: row.region,
        subcity: row.subcity
      });
      if (candidates.length >= limit) return true;
    }
    return false;
  };

  try {
    if (input.sortMode === "random") {
      // Over-sample then filter; if short, take what we get.
      const sampleSize = Math.min(maxScan, Math.max(limit * 8, limit + 200));
      const pipeline =
        Object.keys(query).length === 0
          ? [{ $sample: { size: sampleSize } }, { $project: projection }]
          : [{ $match: query }, { $sample: { size: sampleSize } }, { $project: projection }];
      const rawBusinesses = await collection
        .aggregate(pipeline, { maxTimeMS: CAMPAIGN_QUERY_MAX_MS, allowDiskUse: true })
        .toArray();
      scannedBusinesses = rawBusinesses.length;
      for (const doc of rawBusinesses) {
        if (pushFromBusiness(doc)) break;
      }
      exhausted = candidates.length < limit;
    } else {
      const sortField =
        input.sortMode === "capital_asc" || input.sortMode === "capital_desc" ? "capital" : "value";
      const sortDir = input.sortMode.endsWith("_asc") ? 1 : -1;
      let skip = 0;

      // Batch pages (toArray of PAGE_SIZE) instead of per-document cursor.next() RTT.
      while (candidates.length < limit && scannedBusinesses < maxScan) {
        const take = Math.min(PAGE_SIZE, maxScan - scannedBusinesses);
        const page = await collection
          .find(query)
          .sort({ [sortField]: sortDir })
          .skip(skip)
          .limit(take)
          .project(projection)
          .maxTimeMS(CAMPAIGN_QUERY_MAX_MS)
          .batchSize(PAGE_SIZE)
          .toArray();

        if (!page.length) {
          exhausted = true;
          break;
        }

        scannedBusinesses += page.length;
        skip += page.length;

        let filled = false;
        for (const doc of page) {
          if (pushFromBusiness(doc)) {
            filled = true;
            break;
          }
        }
        if (filled) {
          exhausted = false;
          break;
        }
        if (page.length < take) {
          exhausted = true;
          break;
        }
      }
      if (candidates.length >= limit) exhausted = false;
      else if (scannedBusinesses >= maxScan) exhausted = true;
    }
  } catch (error) {
    // Partial success is better than failing a launch that already found usable leads.
    if (isMaxTimeError(error)) {
      if (candidates.length > 0) {
        return { candidates, scannedBusinesses, exhausted: true };
      }
      const err = new Error(
        "Directory search timed out while selecting leads. Narrow filters (region/sector/capital) or try again."
      );
      (err as Error & { code?: string }).code = "CAMPAIGN_SELECT_TIMEOUT";
      throw err;
    }
    throw error;
  }

  return {
    candidates,
    scannedBusinesses,
    exhausted
  };
}

export async function countRegistryBusinessesMatching(filters: RegistryFilters) {
  try {
    const collection = await getBusinessesCollection();
    const query = buildMongoFilter(filters);
    const onlyPhoneFilter = JSON.stringify(query) === JSON.stringify(hasPhoneClause());
    const total = onlyPhoneFilter
      ? await collection.estimatedDocumentCount()
      : await collection.countDocuments(query, { maxTimeMS: QUERY_MAX_MS });
    return { total, available: true as const };
  } catch {
    return { total: 0, available: false as const };
  }
}

/** Hydrate directory display fields onto unified LeadView rows (source MONGO / registry shells). */
export async function hydrateMongoLeads<T extends LeadView | { source?: string | null; mongoBusinessId?: string | null; externalBusinessId?: string | null; phoneNumber?: string | null }>(
  leads: T[]
): Promise<T[]> {
  const ids = [
    ...new Set(
      leads
        .filter((lead) => {
          const source = String((lead as { source?: string }).source || "").toUpperCase();
          const ext =
            (lead as { externalBusinessId?: string | null }).externalBusinessId ||
            (lead as { mongoBusinessId?: string | null }).mongoBusinessId;
          return (source === "MONGO" || source === "REGISTRY") && ext;
        })
        .map(
          (lead) =>
            ((lead as { externalBusinessId?: string | null }).externalBusinessId ||
              (lead as { mongoBusinessId?: string | null }).mongoBusinessId) as string
        )
    )
  ];
  if (!ids.length) return leads;

  const objectIds = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (!objectIds.length) return leads;

  const collection = await getBusinessesCollection();
  const businesses = (
    await collection
      .find({ _id: { $in: objectIds } })
      .project({
        tin: 1,
        businessName: 1,
        businessType: 1,
        capital: 1,
        value: 1,
        nationality: 1,
        managerFirstName: 1,
        managerLastName: 1,
        businessSectors: 1
      })
      .toArray()
  ).map(asBusiness);
  const byId = new Map(businesses.map((business) => [business._id.toString(), business]));

  return leads.map((lead) => {
    const source = String((lead as { source?: string }).source || "").toUpperCase();
    const extId =
      (lead as { externalBusinessId?: string | null }).externalBusinessId ||
      (lead as { mongoBusinessId?: string | null }).mongoBusinessId;
    if ((source !== "MONGO" && source !== "REGISTRY") || !extId) return lead;
    const business = byId.get(extId);
    if (!business) return { ...lead, registryHydrated: false };

    const phone = str((lead as { phoneNumber?: string }).phoneNumber);
    const key = phone ? tryPhoneKey(phone) : null;
    const sector =
      (business.businessSectors || []).find((item: MongoBusinessSector) => {
        const sectorKey = tryPhoneKey(sectorPhone(item));
        return key && sectorKey === key;
      }) || business.businessSectors?.[0];

    return {
      ...lead,
      fullName: displayName(business, phone) || (lead as { fullName?: string }).fullName,
      businessName: str(business.businessName) || (lead as { businessName?: string | null }).businessName,
      licenceNumber: str(business.tin) || (lead as { licenceNumber?: string | null }).licenceNumber,
      managerFName: str(business.managerFirstName) || (lead as { managerFName?: string | null }).managerFName,
      managerLName: str(business.managerLastName) || (lead as { managerLName?: string | null }).managerLName,
      legalStatusNameEng: str(business.businessType) || (lead as { legalStatusNameEng?: string | null }).legalStatusNameEng,
      businessRegion: str(sector?.region) || (lead as { businessRegion?: string | null }).businessRegion,
      businessWoreda: str(sector?.subcity) || (lead as { businessWoreda?: string | null }).businessWoreda,
      englishDescription:
        str(sector?.englishDescription) || (lead as { englishDescription?: string | null }).englishDescription,
      code: str(sector?.sector) || (lead as { code?: string | null }).code,
      businessTelephone: str(sector?.businessNumber) || (lead as { businessTelephone?: string | null }).businessTelephone,
      mongoBusinessId: extId,
      externalBusinessId: extId,
      registryHydrated: true,
      registry: {
        capital: num(business.capital),
        value: num(business.value),
        nationality: str(business.nationality),
        tin: str(business.tin)
      }
    };
  });
}

export { getLeadViewById, findPhoneOwner };

export async function getRegistrySummary() {
  try {
    const collection = await getBusinessesCollection();
    const totalBusinesses = await collection.estimatedDocumentCount();
    return { totalBusinesses, available: true as const };
  } catch {
    return { totalBusinesses: 0, available: false as const };
  }
}

async function listLocalLeadFilterOptionsUncached() {
  const [regions, subcities, sectors, regRegions, regSubcities, regSectors, registry] = await Promise.all([
    prisma.lead.findMany({
      where: { businessRegion: { not: null } },
      distinct: ["businessRegion"],
      select: { businessRegion: true },
      orderBy: { businessRegion: "asc" },
      take: 500
    }),
    prisma.lead.findMany({
      where: { businessWoreda: { not: null } },
      distinct: ["businessWoreda"],
      select: { businessWoreda: true },
      orderBy: { businessWoreda: "asc" },
      take: 1000
    }),
    prisma.lead.findMany({
      where: { englishDescription: { not: null } },
      distinct: ["englishDescription"],
      select: { englishDescription: true },
      orderBy: { englishDescription: "asc" },
      take: 500
    }),
    prisma.registryLead.findMany({
      where: { regionKey: { not: null } },
      distinct: ["regionKey"],
      select: { regionKey: true },
      take: 500
    }),
    prisma.registryLead.findMany({
      where: { subcityKey: { not: null } },
      distinct: ["subcityKey"],
      select: { subcityKey: true },
      take: 1000
    }),
    prisma.registryLead.findMany({
      where: { sectorKey: { not: null } },
      distinct: ["sectorKey"],
      select: { sectorKey: true },
      take: 500
    }),
    getRegistryFilterOptions().catch(() => ({
      regions: [] as string[],
      subcities: [] as string[],
      sectors: [] as string[]
    }))
  ]);

  const merge = (...lists: string[][]) => [...new Set(lists.flat().filter(Boolean))].sort((x, y) => x.localeCompare(y));

  return {
    regions: merge(
      regions.map((row) => row.businessRegion!).filter(Boolean),
      regRegions.map((row) => row.regionKey!).filter(Boolean),
      registry.regions || []
    ),
    subcities: merge(
      subcities.map((row) => row.businessWoreda!).filter(Boolean),
      regSubcities.map((row) => row.subcityKey!).filter(Boolean),
      registry.subcities || []
    ),
    sectors: merge(
      sectors.map((row) => row.englishDescription!).filter(Boolean),
      regSectors.map((row) => row.sectorKey!).filter(Boolean),
      registry.sectors || []
    ).slice(0, 500)
  };
}

export async function listLocalLeadFilterOptions() {
  if (localLeadFilterOptionsCache && localLeadFilterOptionsCache.expiresAt > Date.now()) {
    return localLeadFilterOptionsCache.value;
  }
  const value = await listLocalLeadFilterOptionsUncached();
  const hasData = value.regions.length > 0 || value.sectors.length > 0;
  localLeadFilterOptionsCache = {
    value,
    expiresAt: Date.now() + (hasData ? 10 * 60_000 : 30_000)
  };
  return value;
}
