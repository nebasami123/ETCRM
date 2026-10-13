import { ActivityType, LeadKind, type Prisma } from "@prisma/client";
import assert from "node:assert/strict";
import { env } from "../src/config/env.js";
import { prisma } from "../src/config/db.js";
import { phoneKey } from "../src/features/leads/leadService.js";
import { phaseForPipelineStage, salesPipelineStages, type SalesPipelineStage } from "../src/features/leads/pipelineStage.js";
import { buildPipelineJourney } from "../src/features/admin/pipelineJourney.js";

const day = 86_400_000;
const stages = salesPipelineStages.filter((stage) => stage !== "Closed Lost");
const profiles = [
  { key: "facebook", source: "Facebook / Instagram — paid ad", reached: [180, 144, 105, 86, 68, 49, 35, 24] },
  { key: "pool", source: "Internal lead pool", reached: [150, 110, 72, 52, 36, 24, 17, 10] },
  { key: "website", source: "Website / online form", reached: [100, 86, 72, 60, 48, 38, 30, 22] },
  { key: "referral", source: "Customer referral", reached: [90, 82, 72, 64, 54, 44, 35, 29] },
  { key: "tiktok", source: "TikTok — paid ad", reached: [80, 56, 36, 24, 16, 10, 6, 3] }
];
const names = ["Hana Bekele", "Abel Tesfaye", "Mekdes Fikre", "Yared Getachew", "Saron Mamo", "Faisal Ahmed", "Tsion Birhanu", "Kalkidan Tadesse", "Tigist Dagne", "Mamush Gashaw", "Rahel Kebede", "Meron Abebe"];
const notes: Record<SalesPipelineStage, string> = {
  Lead: "Enquiry received. Awaiting first contact.",
  Contacted: "Spoke with the owner and confirmed their service needs.",
  "Meeting Booked": "Requirements meeting agreed with the decision maker.",
  "Showed Up": "Customer attended the meeting and discussed their current workflow.",
  "Demo / Presentation": "Presented the service and answered the customer's questions.",
  Proposal: "Sent the written proposal with pricing and rollout details.",
  Negotiation: "Discussing the final terms and implementation date.",
  "Closed Won": "Customer accepted the proposal. Handoff to onboarding completed.",
  "Closed Lost": "Customer postponed the project after reviewing the available options."
};

async function main() {
  const database = new URL(env.DATABASE_URL);
  if (env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname)) {
    throw new Error("Pipeline demo seeding only runs against local PostgreSQL outside production.");
  }
  if (!process.argv.includes("--include-demo-data")) throw new Error("Pass --include-demo-data to add the pipeline demo cohort.");

  const [owners, admin] = await Promise.all([
    prisma.user.findMany({ where: { role: "SALES", OR: [{ banned: false }, { banned: null }] }, select: { id: true }, orderBy: { email: "asc" } }),
    prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })
  ]);
  if (!owners.length || !admin) throw new Error("Create an admin and at least one sales agent before seeding pipeline journeys.");

  const now = Date.now();
  const leads: Prisma.LeadCreateManyInput[] = [];
  const events: Prisma.ActivityEventCreateManyInput[] = [];
  let serial = 0;
  for (const profile of profiles) {
    for (let index = 0; index < profile.reached[0]; index += 1) {
      serial += 1;
      const owner = owners[(serial - 1) % owners.length];
      const id = `pipeline-demo-v1-${profile.key}-${String(index + 1).padStart(3, "0")}`;
      const phone = `+999 710 ${String(serial).padStart(6, "0")}`;
      const last = profile.reached.reduce((rank, count, position) => index < count ? position : rank, 0);
      let path: SalesPipelineStage[] = stages.slice(0, last + 1);
      // Small cohorts exercise real skipping, repeat updates, regressions, and early losses.
      if (last >= 5 && index % 17 === 0) path = path.filter((stage) => stage !== "Meeting Booked");
      if (last > 0 && index % 13 === 0) path.splice(path.indexOf("Contacted") + 1, 0, "Contacted");
      if (last === 6 && index % 3 === 0) path.push("Proposal");
      if (last > 0 && last < 7 && index % 11 === 0) path.push("Closed Lost");
      const final = path.at(-1)!;
      const terminal = final === "Closed Won" || final === "Closed Lost";
      const claimed = final !== "Lead" || index % 4 !== 0;
      const firstSeen = new Date(now - (path.length + 1 + serial % 28) * day);
      const lastUpdate = new Date(firstSeen.getTime() + (path.length - 1) * day);
      const followUp = !terminal && claimed ? new Date(now + ((serial % 7) - 2) * day) : null;
      const appointmentIndex = path.indexOf("Meeting Booked");
      const appointment = appointmentIndex < 0 ? null : final === "Meeting Booked"
        ? new Date(now + (1 + serial % 4) * day)
        : new Date(firstSeen.getTime() + (appointmentIndex + 1) * day);
      leads.push({
        id, fullName: `Demo · ${names[(serial - 1) % names.length]} ${String(serial).padStart(3, "0")}`,
        phoneNumber: phone, phoneKey: phoneKey(phone), email: `pipeline-demo-${serial}@example.invalid`,
        pipelineStage: final, phase: phaseForPipelineStage(final),
        leadSource: profile.source, leadSourceDetail: "Pipeline visualization demo v1",
        createdById: owner.id, claimedById: claimed ? owner.id : null, claimedAt: claimed ? firstSeen : null,
        appointmentDate: appointment, nextFollowUpAt: followUp, createdAt: firstSeen, updatedAt: lastUpdate
      });
      const base = { leadKind: LeadKind.LOCAL, leadId: id, actorId: owner.id };
      events.push({ ...base, type: ActivityType.LEAD_CREATED, createdAt: firstSeen,
        note: "Demo cohort: pipeline visualization.",
        metadata: { demoCohort: "pipeline-v1", pipelineStage: "Lead", leadSource: profile.source, claimedOnCreate: claimed } });
      if (claimed) events.push({ ...base, type: ActivityType.LEAD_CLAIMED, createdAt: new Date(firstSeen.getTime() + 1000) });
      for (let step = 1; step < path.length; step += 1) {
        const stage = path[step];
        const previous = path[step - 1];
        const createdAt = new Date(firstSeen.getTime() + step * day);
        events.push({ ...base, actorId: stage === "Closed Won" ? admin.id : owner.id,
          creditedUserId: stage === "Closed Won" || stage === "Closed Lost" ? owner.id : null,
          type: ActivityType.PHASE_CHANGED, createdAt,
          fromPhase: phaseForPipelineStage(previous), toPhase: phaseForPipelineStage(stage),
          metadata: { demoCohort: "pipeline-v1", fromPipelineStage: previous, pipelineStage: stage } });
        events.push({ ...base, type: ActivityType.CALL_NOTE, createdAt: new Date(createdAt.getTime() + 1000), note: `Demo: ${notes[stage]}` });
      }
      if (followUp) events.push({ ...base, type: ActivityType.FOLLOW_UP_SET, createdAt: new Date(lastUpdate.getTime() + 2000), metadata: { nextFollowUpAt: followUp.toISOString() } });
    }
  }

  const keys = leads.map((lead) => lead.phoneKey);
  const [existingIds, localPhones, registryPhones, indexedPhones] = await Promise.all([
    prisma.lead.findMany({ where: { id: { in: leads.map((lead) => lead.id!) } }, select: { id: true } }),
    prisma.lead.findMany({ where: { phoneKey: { in: keys } }, select: { phoneKey: true } }),
    prisma.registryLead.findMany({ where: { phoneKey: { in: keys } }, select: { phoneKey: true } }),
    prisma.leadPhoneIndex.findMany({ where: { phoneKey: { in: keys } }, select: { phoneKey: true } })
  ]);
  const present = new Set(existingIds.map((lead) => lead.id));
  const occupied = new Set([...localPhones, ...registryPhones, ...indexedPhones].map((lead) => lead.phoneKey));
  const pending = leads.filter((lead) => !present.has(lead.id!) && !occupied.has(lead.phoneKey));
  const pendingIds = new Set(pending.map((lead) => lead.id!));
  await prisma.$transaction(async (db) => {
    if (!pending.length) return;
    await db.lead.createMany({ data: pending });
    await db.leadPhoneIndex.createMany({ data: pending.map((lead) => ({ phoneKey: lead.phoneKey, kind: LeadKind.LOCAL, leadId: lead.id! })) });
    await db.activityEvent.createMany({ data: events.filter((event) => pendingIds.has(event.leadId!)) });
  }, { timeout: 60_000 });

  if (pending.length) {
    const [writtenLeads, writtenEvents] = await Promise.all([
      prisma.lead.findMany({ where: { id: { in: [...pendingIds] } }, select: { id: true, pipelineStage: true, phase: true, leadSource: true } }),
      prisma.activityEvent.findMany({ where: { leadKind: LeadKind.LOCAL, leadId: { in: [...pendingIds] } }, select: { leadId: true, leadKind: true, metadata: true, fromPhase: true, toPhase: true } })
    ]);
    const expected = buildPipelineJourney(pending.map((lead) => ({ id: lead.id!, kind: "LOCAL", pipelineStage: lead.pipelineStage!, phase: lead.phase!, leadSource: lead.leadSource! })),
      events.filter((event) => pendingIds.has(event.leadId!)).map((event) => ({ leadId: event.leadId!, leadKind: event.leadKind!, metadata: event.metadata, fromPhase: event.fromPhase ?? null, toPhase: event.toPhase ?? null })), 0);
    const actual = buildPipelineJourney(writtenLeads.map((lead) => ({ ...lead, kind: "LOCAL" })), writtenEvents, 0);
    assert.equal(writtenLeads.length, pending.length);
    assert.deepEqual(actual.pipelineCounts, expected.pipelineCounts, "Saved history must reproduce the planned demo journey.");
  }

  const demo = buildPipelineJourney(leads.map((lead) => ({ id: lead.id!, kind: "LOCAL", pipelineStage: lead.pipelineStage!, phase: lead.phase!, leadSource: lead.leadSource! })),
    events.map((event) => ({ leadId: event.leadId!, leadKind: event.leadKind!, metadata: event.metadata, fromPhase: event.fromPhase ?? null, toPhase: event.toPhase ?? null })), 0);
  console.log(`Pipeline demo seed: ${pending.length} added, ${leads.length - pending.length} existing/conflicting records preserved.`);
  console.log("Designed demo cohort journey:", JSON.stringify(demo.pipelineCounts));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
