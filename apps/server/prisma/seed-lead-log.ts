import { ActivityType, LeadKind, type LeadPhase } from "@prisma/client";
import { env } from "../src/config/env.js";
import { prisma } from "../src/config/db.js";
import { phoneKey } from "../src/features/leads/leadService.js";
import { phaseForPipelineStage, type SalesPipelineStage } from "../src/features/leads/pipelineStage.js";

const dayMs = 24 * 60 * 60 * 1000;
const now = new Date();

const sampleLeads: Array<{
  name: string;
  phone: string;
  email: string;
  business: string;
  region: string;
  woreda: string;
  licence: string;
  source: string;
  ownerEmail: string;
  followUpDays: number;
  updates: Array<{ stage: SalesPipelineStage; note: string }>;
}> = [
  {
    name: "Hana Bekele", phone: "+251 911 40 0101", email: "hana.bekele.demo@example.com",
    business: "Kaffa Coffee Export", region: "Addis Ababa", woreda: "Bole",
    licence: "LIC-DEMO-1001", source: "Facebook / Instagram — paid ad", ownerEmail: "sales@etcrm.local", followUpDays: 1,
    updates: [
      { stage: "Contacted", note: "Reached Hana by phone. She is comparing business account options and asked for a short overview." },
      { stage: "Meeting Booked", note: "Booked a meeting for Thursday morning. Send the document checklist before the call." }
    ]
  },
  {
    name: "Abel Tesfaye", phone: "+251 911 40 0102", email: "abel.tesfaye.demo@example.com",
    business: "Blue Nile Building Supply", region: "Oromia", woreda: "Adama",
    licence: "LIC-DEMO-1002", source: "Internal lead pool", ownerEmail: "sales@etcrm.local", followUpDays: 3,
    updates: [
      { stage: "Contacted", note: "Reached the owner. He asked about the requirements for a second branch." },
      { stage: "Meeting Booked", note: "In-person visit agreed for next week; confirm the exact time by phone." },
      { stage: "Showed Up", note: "Met Abel and reviewed the business documents he already has." },
      { stage: "Demo / Presentation", note: "Good fit: active business, clear need, and decision-maker engaged. Waiting on one licence copy." }
    ]
  },
  {
    name: "Mekdes Fikre", phone: "+251 911 40 0103", email: "mekdes.fikre.demo@example.com",
    business: "Mekdes Family Pharmacy", region: "Amhara", woreda: "Bahir Dar",
    licence: "LIC-DEMO-1003", source: "Walk-in", ownerEmail: "maria@etcrm.local", followUpDays: 2,
    updates: [
      { stage: "Contacted", note: "Walk-in enquiry. Mekdes requested a call after checking with her business partner." }
    ]
  },
  {
    name: "Yared Getachew", phone: "+251 911 40 0104", email: "yared.getachew.demo@example.com",
    business: "Yared Digital Print", region: "Addis Ababa", woreda: "Kirkos",
    licence: "LIC-DEMO-1004", source: "TikTok — paid ad", ownerEmail: "maria@etcrm.local", followUpDays: 4,
    updates: [
      { stage: "Contacted", note: "Responded to the campaign enquiry. The business has been operating for three years." },
      { stage: "Meeting Booked", note: "Video call scheduled to understand transaction volume and service needs." },
      { stage: "Showed Up", note: "Yared joined the call with his operations lead and shared the current workflow." },
      { stage: "Demo / Presentation", note: "Walked through the account setup and reporting flow. Requested a written proposal." }
    ]
  },
  {
    name: "Saron Mamo", phone: "+251 911 40 0105", email: "saron.mamo.demo@example.com",
    business: "Selam Boutique Hotel", region: "Sidama", woreda: "Hawassa",
    licence: "LIC-DEMO-1005", source: "Customer referral", ownerEmail: "dawit@etcrm.local", followUpDays: 0,
    updates: [
      { stage: "Contacted", note: "Referral introduction received and first call completed." },
      { stage: "Meeting Booked", note: "Scheduled a site visit with the manager." },
      { stage: "Showed Up", note: "Completed the visit and explained the available options." },
      { stage: "Closed Lost", note: "The hotel has paused new services until its renovation is complete. Revisit next quarter if invited." }
    ]
  },
  {
    name: "Faisal Ahmed", phone: "+251 911 40 0106", email: "faisal.ahmed.demo@example.com",
    business: "Dire Dawa Auto Parts", region: "Dire Dawa", woreda: "Kezira",
    licence: "LIC-DEMO-1006", source: "Website / online form", ownerEmail: "dawit@etcrm.local", followUpDays: 2,
    updates: [
      { stage: "Contacted", note: "Called after the online enquiry. Faisal prefers an afternoon meeting." },
      { stage: "Meeting Booked", note: "Afternoon meeting confirmed; bring the pricing overview." }
    ]
  },
  {
    name: "Tsion Birhanu", phone: "+251 911 40 0107", email: "tsion.birhanu.demo@example.com",
    business: "Lomi Fresh Foods", region: "Central Ethiopia", woreda: "Hawassa Zuria",
    licence: "LIC-DEMO-1007", source: "Employee / agent referral", ownerEmail: "sales@etcrm.local", followUpDays: 5,
    updates: [
      { stage: "Contacted", note: "Referral contacted. Tsion is the owner and primary decision-maker." },
      { stage: "Meeting Booked", note: "Meeting held on the calendar for next week." },
      { stage: "Showed Up", note: "Tsion attended and described seasonal cash-flow needs." },
      { stage: "Demo / Presentation", note: "Qualified for a follow-up proposal; verify the business documents first." }
    ]
  },
  {
    name: "Kalkidan Tadesse", phone: "+251 911 40 0108", email: "kalkidan.tadesse.demo@example.com",
    business: "Arada Design Studio", region: "Addis Ababa", woreda: "Arada",
    licence: "LIC-DEMO-1008", source: "Other", ownerEmail: "maria@etcrm.local", followUpDays: 0,
    updates: []
  },
  {
    name: "Tigist Dagne", phone: "+251 911 40 0111", email: "tigist.dagne.demo@example.com",
    business: "Tigist Home Textiles", region: "Addis Ababa", woreda: "Yeka",
    licence: "LIC-DEMO-1011", source: "TikTok — paid ad", ownerEmail: "sales@etcrm.local", followUpDays: 2,
    updates: [
      { stage: "Contacted", note: "Tigist responded to the ad and described her home textile shop." },
      { stage: "Meeting Booked", note: "Set a short meeting to review her sales and deposit needs." },
      { stage: "Showed Up", note: "Tigist attended the meeting and confirmed interest in the service." }
    ]
  },
  {
    name: "Mamush Gashaw", phone: "+251 911 40 0112", email: "mamush.gashaw.demo@example.com",
    business: "Blue Horizon Printing", region: "Amhara", woreda: "Bahir Dar",
    licence: "LIC-DEMO-1012", source: "Website / online form", ownerEmail: "maria@etcrm.local", followUpDays: 4,
    updates: [
      { stage: "Contacted", note: "Reached Mamush and confirmed he is comparing business providers." },
      { stage: "Meeting Booked", note: "Booked a requirements review with the business owner." },
      { stage: "Showed Up", note: "Mamush attended and shared the current payment workflow." },
      { stage: "Demo / Presentation", note: "Presented the service options and agreed on a commercial proposal." },
      { stage: "Proposal", note: "Sent the written proposal and itemized pricing for review." }
    ]
  },
  {
    name: "Rahel Kebede", phone: "+251 911 40 0113", email: "rahel.kebede.demo@example.com",
    business: "Aster Medical Supplies", region: "Oromia", woreda: "Adama",
    licence: "LIC-DEMO-1013", source: "Customer referral", ownerEmail: "dawit@etcrm.local", followUpDays: 3,
    updates: [
      { stage: "Contacted", note: "Referral introduction completed with Rahel, the business owner." },
      { stage: "Meeting Booked", note: "Scheduled a meeting to map purchasing and settlement requirements." },
      { stage: "Showed Up", note: "Rahel attended with the operations lead and shared monthly volumes." },
      { stage: "Demo / Presentation", note: "Demonstrated the workflow and answered the operations team's questions." },
      { stage: "Proposal", note: "Proposal reviewed; Rahel requested a revised rollout date." },
      { stage: "Negotiation", note: "Discussing rollout timing and final service terms before a decision." }
    ]
  }
];

async function main() {
  if (env.NODE_ENV === "production") {
    throw new Error("Lead Log demo data is disabled in production.");
  }
  if (!process.argv.includes("--include-demo-data")) {
    throw new Error("This script adds demo leads. Re-run with --include-demo-data to confirm.");
  }

  const salesUsers = await prisma.user.findMany({ where: { role: "SALES" }, select: { id: true, email: true } });
  const userIds = new Map(salesUsers.map((user) => [user.email, user.id]));
  const missingOwners = [...new Set(sampleLeads.map((lead) => lead.ownerEmail))].filter((email) => !userIds.has(email));
  if (missingOwners.length) {
    throw new Error(`Seed the demo users first; missing sales accounts: ${missingOwners.join(", ")}`);
  }

  let created = 0;
  let alreadyPresent = 0;

  for (const sample of sampleLeads) {
    const ownerId = userIds.get(sample.ownerEmail)!;
    const key = phoneKey(sample.phone);
    if (await prisma.leadPhoneIndex.findUnique({ where: { phoneKey: key } })) {
      alreadyPresent += 1;
      continue;
    }

    const firstSeenAt = new Date(now.getTime() - (sample.updates.length + 10) * dayMs);
    const finalStage = sample.updates.at(-1)?.stage ?? "Lead";
    const followUpAt = sample.followUpDays > 0 ? new Date(now.getTime() + sample.followUpDays * dayMs) : null;

    await prisma.$transaction(async (db) => {
      const lead = await db.lead.create({
        data: {
          fullName: sample.name,
          phoneNumber: sample.phone,
          phoneKey: key,
          email: sample.email,
          phase: phaseForPipelineStage(finalStage),
          pipelineStage: finalStage,
          leadSource: sample.source,
          leadSourceDetail: sample.source === "Other" ? "Local demo sample" : null,
          createdById: ownerId,
          claimedById: ownerId,
          claimedAt: firstSeenAt,
          nextFollowUpAt: followUpAt,
          appointmentDate: sample.updates.some((update) => update.stage === "Meeting Booked")
            ? new Date(now.getTime() + 2 * dayMs)
            : null,
          createdAt: firstSeenAt
        }
      });
      await db.leadPhoneIndex.create({ data: { phoneKey: key, kind: LeadKind.LOCAL, leadId: lead.id } });

      const events: Array<{
        actorId: string;
        leadKind: LeadKind;
        leadId: string;
        type: ActivityType;
        fromPhase?: LeadPhase;
        toPhase?: LeadPhase;
        note?: string;
        metadata?: object;
        createdAt: Date;
      }> = [
        {
          actorId: ownerId, leadKind: LeadKind.LOCAL, leadId: lead.id,
          type: ActivityType.LEAD_CREATED,
          metadata: { claimedOnCreate: true, pipelineStage: "Lead", leadSource: sample.source },
          createdAt: firstSeenAt
        },
        {
          actorId: ownerId, leadKind: LeadKind.LOCAL, leadId: lead.id,
          type: ActivityType.LEAD_CLAIMED, createdAt: new Date(firstSeenAt.getTime() + 1000)
        }
      ];

      let fromStage: SalesPipelineStage = "Lead";
      sample.updates.forEach((update, index) => {
        const createdAt = new Date(now.getTime() - (sample.updates.length - index) * 2 * dayMs);
        const fromPhase = phaseForPipelineStage(fromStage);
        const toPhase = phaseForPipelineStage(update.stage);
        events.push({
          actorId: ownerId, leadKind: LeadKind.LOCAL, leadId: lead.id,
          type: ActivityType.PHASE_CHANGED, fromPhase, toPhase,
          metadata: { pipelineStage: update.stage }, createdAt
        });
        events.push({
          actorId: ownerId, leadKind: LeadKind.LOCAL, leadId: lead.id,
          type: ActivityType.CALL_NOTE, note: update.note,
          createdAt: new Date(createdAt.getTime() + 1000)
        });
        fromStage = update.stage;
      });

      await db.activityEvent.createMany({ data: events });
    });
    created += 1;
  }

  console.log(`Lead Log demo seed complete: ${created} leads added, ${alreadyPresent} already present.`);
  console.log("Demo leads are assigned across sales@etcrm.local, maria@etcrm.local, and dawit@etcrm.local.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
