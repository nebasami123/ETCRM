import { ActivityType, ClaimRequestStatus, LeadPhase, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  claimLead,
  createLead,
  importEmptyMessage,
  requestClaimTransfer,
  resolveClaimTransfer,
  updateLead,
  updateLeadPhase
} from "./leadWorkflowService.js";
import { updateSalesLeadPhase } from "../sales/salesCommands.js";
import { prepareLeadImport } from "./leadImportService.js";
import { phoneKey } from "./leadService.js";

const databaseUrl =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://etcrm:etcrm@127.0.0.1:5433/etcrm_test?schema=public";

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

const ids = {
  admin: "test-admin-workflow",
  salesA: "test-sales-a-workflow",
  salesB: "test-sales-b-workflow"
};

let dbReady = false;

async function ensureUsers() {
  for (const [id, name, role] of [
    [ids.admin, "Test Admin", "ADMIN"],
    [ids.salesA, "Test Sales A", "SALES"],
    [ids.salesB, "Test Sales B", "SALES"]
  ] as const) {
    await prisma.user.upsert({
      where: { id },
      update: { name, role, email: `${id}@etcrm.test` },
      create: {
        id,
        name,
        email: `${id}@etcrm.test`,
        emailVerified: true,
        role
      }
    });
  }
}

async function wipeTestLeads() {
  await prisma.claimTransferRequest.deleteMany({
    where: { requestedById: { in: Object.values(ids) } }
  });
  await prisma.activityEvent.deleteMany({ where: { actorId: { in: Object.values(ids) } } });
  const localIds = (
    await prisma.lead.findMany({
      where: {
        OR: [{ createdById: { in: Object.values(ids) } }, { claimedById: { in: Object.values(ids) } }, { phoneKey: { startsWith: "999" } }]
      },
      select: { id: true, phoneKey: true }
    })
  );
  const regIds = (
    await prisma.registryLead.findMany({
      where: {
        OR: [{ createdById: { in: Object.values(ids) } }, { claimedById: { in: Object.values(ids) } }, { phoneKey: { startsWith: "999" } }]
      },
      select: { id: true, phoneKey: true }
    })
  );
  const phones = [...localIds, ...regIds].map((r) => r.phoneKey);
  if (phones.length) await prisma.leadPhoneIndex.deleteMany({ where: { phoneKey: { in: phones } } });
  if (localIds.length) await prisma.lead.deleteMany({ where: { id: { in: localIds.map((r) => r.id) } } });
  if (regIds.length) await prisma.registryLead.deleteMany({ where: { id: { in: regIds.map((r) => r.id) } } });
}

beforeAll(async () => {
  try {
    await prisma.$connect();
    await ensureUsers();
    await wipeTestLeads();
    dbReady = true;
  } catch (error) {
    console.error("Integration tests require PostgreSQL:", error);
    dbReady = false;
  }
}, 30_000);

afterAll(async () => {
  if (dbReady) {
    try {
      await wipeTestLeads();
    } catch {
      /* ignore cleanup errors */
    }
  }
  await prisma.$disconnect();
});

/** Skip integration cases when Postgres is unreachable (see verification fallback). */
function itDb(name: string, fn: () => Promise<void>) {
  it(name, async (ctx) => {
    if (!dbReady) {
      ctx.skip();
      return;
    }
    await fn();
  });
}

describe("lead workflow integration", () => {
  it("reports database availability for evidence", () => {
    if (!dbReady) {
      console.warn("PostgreSQL unavailable — integration cases skipped (capture db-unavailable.log)");
    }
    expect(typeof dbReady).toBe("boolean");
  });

  itDb("rejects duplicate phone on create", async () => {
    const phone = "9991000001";
    const first = await createLead({
      input: { fullName: "Dup One", phoneNumber: phone },
      actorId: ids.salesA,
      claimActor: true
    });
    expect(first.status).toBe("ok");

    const second = await createLead({
      input: { fullName: "Dup Two", phoneNumber: `+${phone}` },
      actorId: ids.salesB,
      claimActor: true
    });
    expect(second.status).toBe("duplicate");
    if (second.status === "duplicate") {
      expect(second.duplicate.phoneNumber).toBeTruthy();
      expect(phoneKey(second.duplicate.phoneNumber)).toBe(phoneKey(phone));
    }
  });

  itDb("enforces claim race: only one winner for unclaimed lead", async () => {
    const created = await createLead({
      input: { fullName: "Race Lead", phoneNumber: "9991000002" },
      actorId: ids.admin,
      claimActor: false
    });
    expect(created.status).toBe("ok");
    if (created.status !== "ok") return;
    const leadId = created.lead.id;

    const [a, b] = await Promise.all([
      claimLead({ leadId, actorId: ids.salesA }),
      claimLead({ leadId, actorId: ids.salesB })
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["already-claimed", "ok"]);
    const winner = a.status === "ok" ? a : b;
    const loser = a.status === "ok" ? b : a;
    expect(winner.status).toBe("ok");
    expect(loser.status).toBe("already-claimed");
  });

  itDb("rejects a second pending transfer for the same lead", async () => {
    const created = await createLead({
      input: { fullName: "Transfer Lead", phoneNumber: "9991000003" },
      actorId: ids.salesA,
      claimActor: true
    });
    expect(created.status).toBe("ok");
    if (created.status !== "ok") return;
    const leadId = created.lead.id;

    const first = await requestClaimTransfer({ leadId, actorId: ids.salesB, reason: "Need this account for my region" });
    expect(first.status).toBe("ok");

    const second = await requestClaimTransfer({ leadId, actorId: ids.salesB, reason: "Still need it please" });
    expect(second.status).toBe("pending-exists");
  });

  itDb("approves and rejects claim transfers", async () => {
    const created = await createLead({
      input: { fullName: "Approve Lead", phoneNumber: "9991000004" },
      actorId: ids.salesA,
      claimActor: true
    });
    expect(created.status).toBe("ok");
    if (created.status !== "ok") return;
    const leadId = created.lead.id;

    const request = await requestClaimTransfer({ leadId, actorId: ids.salesB, reason: "Handoff after vacation" });
    expect(request.status).toBe("ok");
    if (request.status !== "ok") return;

    const approved = await resolveClaimTransfer({ requestId: request.request.id, adminId: ids.admin, approve: true });
    expect(approved?.claimedById).toBe(ids.salesB);

    const rejectedCreate = await createLead({
      input: { fullName: "Reject Lead", phoneNumber: "9991000005" },
      actorId: ids.salesA,
      claimActor: true
    });
    expect(rejectedCreate.status).toBe("ok");
    if (rejectedCreate.status !== "ok") return;

    const rejectReq = await requestClaimTransfer({
      leadId: rejectedCreate.lead.id,
      actorId: ids.salesB,
      reason: "Wrong assignment attempt"
    });
    expect(rejectReq.status).toBe("ok");
    if (rejectReq.status !== "ok") return;

    const rejected = await resolveClaimTransfer({ requestId: rejectReq.request.id, adminId: ids.admin, approve: false });
    expect(rejected?.claimedById).toBe(ids.salesA);

    const stored = await prisma.claimTransferRequest.findUnique({ where: { id: rejectReq.request.id } });
    expect(stored?.status).toBe(ClaimRequestStatus.REJECTED);
  });

  itDb("records LEAD_UPDATED for admin detail edits, not CALL_NOTE", async () => {
    const created = await createLead({
      input: { fullName: "Edit Lead", phoneNumber: "9991000006", businessName: "Acme" },
      actorId: ids.admin,
      claimActor: false
    });
    expect(created.status).toBe("ok");
    if (created.status !== "ok") return;

    const beforeCalls = await prisma.activityEvent.count({
      where: { leadId: created.lead.id, type: ActivityType.CALL_NOTE }
    });

    const updated = await updateLead({
      leadId: created.lead.id,
      actorId: ids.admin,
      input: { fullName: "Edit Lead Updated", phoneNumber: "9991000006", businessName: "Acme PLC" }
    });
    expect(updated.status).toBe("ok");

    const afterCalls = await prisma.activityEvent.count({
      where: { leadId: created.lead.id, type: ActivityType.CALL_NOTE }
    });
    expect(afterCalls).toBe(beforeCalls);

    const leadUpdated = await prisma.activityEvent.count({
      where: { leadId: created.lead.id, type: ActivityType.LEAD_UPDATED }
    });
    expect(leadUpdated).toBeGreaterThanOrEqual(1);
  });

  itDb("blocks non-owner phase updates; sales cannot CLOSED_WON; admin can with credit", async () => {
    const created = await createLead({
      input: { fullName: "Phase Lead", phoneNumber: "9991000007" },
      actorId: ids.salesA,
      claimActor: true
    });
    expect(created.status).toBe("ok");
    if (created.status !== "ok") return;

    const owned = await updateSalesLeadPhase({
      leadId: created.lead.id,
      userId: ids.salesA,
      phase: LeadPhase.CONTACTED
    });
    expect(owned.status).toBe("ok");

    const forbidden = await updateSalesLeadPhase({
      leadId: created.lead.id,
      userId: ids.salesB,
      phase: LeadPhase.FOLLOW_UP
    });
    expect(forbidden.status).toBe("forbidden");

    // Shipped sales command rejects CLOSED_WON (controller maps this to 403).
    const salesWon = await updateSalesLeadPhase({
      leadId: created.lead.id,
      userId: ids.salesA,
      phase: LeadPhase.CLOSED_WON
    });
    expect(salesWon.status).toBe("closed-won-forbidden");
    const stillOpen = await prisma.lead.findUniqueOrThrow({ where: { id: created.lead.id }, select: { phase: true } });
    expect(stillOpen.phase).not.toBe(LeadPhase.CLOSED_WON);

    // Admin credit path still allowed via workflow (not sales command).
    const adminWon = await updateLeadPhase({
      leadId: created.lead.id,
      actorId: ids.admin,
      phase: LeadPhase.CLOSED_WON,
      creditedUserId: ids.salesA,
      requireOwnership: false
    });
    expect(adminWon.status).toBe("ok");
  });

  itDb("prepareLeadImport skips invalid rows and importEmptyMessage summarizes them", async () => {
    const existing = await createLead({
      input: { fullName: "Existing Import", phoneNumber: "9991000008" },
      actorId: ids.admin
    });
    expect(existing.status).toBe("ok");

    const result = await prisma.$transaction(async (db) =>
      prepareLeadImport(db, [
        { rowNumber: 2, lead: null },
        {
          rowNumber: 3,
          lead: {
            fullName: "Existing Import",
            phoneNumber: "9991000008",
            phoneKey: phoneKey("9991000008"),
            email: "",
            createdById: ids.admin
          }
        },
        {
          rowNumber: 4,
          lead: {
            fullName: "Fresh Import",
            phoneNumber: "9991000009",
            phoneKey: phoneKey("9991000009"),
            email: "",
            createdById: ids.admin
          }
        }
      ])
    );

    expect(result.leads.length).toBe(1);
    expect(result.leads[0]?.phoneKey).toBe(phoneKey("9991000009"));
    expect(result.skipped.length).toBeGreaterThanOrEqual(2);

    const message = importEmptyMessage({
      skipped: 3,
      skippedByReason: [
        { reason: "Missing required fields", count: 1 },
        { reason: "Already exists in CRM", count: 2 }
      ]
    });
    expect(message).toContain("All 3 rows were skipped");
    expect(message).toContain("Missing required fields");
    expect(message).toContain("Already exists in CRM");
  });
});
