import { LeadPhase, ActivityType } from "@prisma/client";
import { auth } from "../src/auth/auth.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/config/db.js";
import { parseBusinessDate } from "../src/utils/dates.js";
import { phoneKey } from "../src/features/leads/leadService.js";
import { pipelineStageForPhase } from "../src/features/leads/pipelineStage.js";

async function createUser(input: { name: string; email: string; password: string; role: "ADMIN" | "SALES" }) {
  const result = await auth.api.createUser({
    body: {
      ...input,
      role: input.role as never
    }
  });
  if (input.role === "SALES") await prisma.user.update({ where: { id: result.user.id }, data: { salesType: "INTERNAL" } });
  return result.user;
}

async function main() {
  if (!env.ADMIN_NAME || !env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD are required for production bootstrap.");
  }
  if (env.ADMIN_PASSWORD.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }

  const includeDemoData = process.argv.includes("--include-demo-data");
  if (env.NODE_ENV === "production" && includeDemoData) {
    throw new Error("Demo data is never allowed in production.");
  }

  console.log("Seeding production admin...");
  const prodAdmin = await createUser({
    name: env.ADMIN_NAME,
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
    role: "ADMIN"
  });
  console.log(`Production admin ready: ${prodAdmin.email}`);

  if (env.NODE_ENV === "production" || !includeDemoData) {
    console.log("Admin bootstrap complete. Demo data is disabled unless --include-demo-data is explicitly set outside production.");
    return;
  }

  console.log("Seeding Ethiopian mock users...");
  const admin = await createUser({
    name: "Yohannes Tekle",
    email: "admin@etcrm.local",
    password: "password123",
    role: "ADMIN"
  });

  const bekele = await createUser({
    name: "Bekele Lemma",
    email: "sales@etcrm.local",
    password: "password123",
    role: "SALES"
  });

  const selam = await createUser({
    name: "Selamawit Asefa",
    email: "maria@etcrm.local",
    password: "password123",
    role: "SALES"
  });

  const dawit = await createUser({
    name: "Dawit Tolosa",
    email: "dawit@etcrm.local",
    password: "password123",
    role: "SALES"
  });

  console.log("Seeding business quotas...");
  const date = parseBusinessDate();
  await prisma.quota.create({
    data: { salesUserId: bekele.id, date, callsTarget: 15, leadsTarget: 10 }
  });
  await prisma.quota.create({
    data: { salesUserId: selam.id, date, callsTarget: 12, leadsTarget: 8 }
  });
  await prisma.quota.create({
    data: { salesUserId: dawit.id, date, callsTarget: 10, leadsTarget: 6 }
  });

  console.log("Seeding realistic Ethiopian leads and activity histories...");
  
  // Lead 4: Frehiwot Kebede (NEW under Selamawit)
  const lead4 = await prisma.lead.create({
    data: {
      fullName: "Frehiwot Kebede",
      phoneNumber: "+251 914 45 6789",
      phoneKey: phoneKey("+251 914 45 6789"),
      email: "frehiwot.k@example.com",
      phase: LeadPhase.NEW,
      pipelineStage: pipelineStageForPhase(LeadPhase.NEW),
      createdById: selam.id,
      claimedById: selam.id,
      claimedAt: new Date(),
    }
  });

  await prisma.activityEvent.createMany({
    data: [
      {
        leadId: lead4.id,
        actorId: selam.id,
        type: ActivityType.LEAD_CREATED,
        note: "Created manually after phone discovery."
      },
      {
        leadId: lead4.id,
        actorId: selam.id,
        type: ActivityType.LEAD_CLAIMED,
        note: "Claimed lead automatically upon creation."
      }
    ]
  });

  // Lead 5: Abdi Ibrahim (NEW under Dawit)
  const lead5 = await prisma.lead.create({
    data: {
      fullName: "Abdi Ibrahim",
      phoneNumber: "+251 915 56 7890",
      phoneKey: phoneKey("+251 915 56 7890"),
      email: "abdi.ibrahim@example.com",
      phase: LeadPhase.NEW,
      pipelineStage: pipelineStageForPhase(LeadPhase.NEW),
      createdById: dawit.id,
      claimedById: dawit.id,
      claimedAt: new Date(),
    }
  });

  await prisma.activityEvent.create({
    data: {
      leadId: lead5.id,
      actorId: dawit.id,
      type: ActivityType.LEAD_CREATED,
      note: "Lead imported from Merkato business directory listing."
    }
  });

  // Lead 8: Betty Girmay (NEW under Selamawit)
  await prisma.lead.create({
    data: {
      fullName: "Betty Girmay",
      phoneNumber: "+251 918 89 0123",
      phoneKey: phoneKey("+251 918 89 0123"),
      email: "betty.g@example.com",
      phase: LeadPhase.NEW,
      pipelineStage: pipelineStageForPhase(LeadPhase.NEW),
      createdById: selam.id,
      claimedById: selam.id,
      claimedAt: new Date(),
    }
  });

  // Lead 10: Kidist Weldemariam (NEW - Unclaimed)
  await prisma.lead.create({
    data: {
      fullName: "Kidist Weldemariam",
      phoneNumber: "+251 921 23 4567",
      phoneKey: phoneKey("+251 921 23 4567"),
      email: "kidist.w@example.com",
      phase: LeadPhase.NEW,
      pipelineStage: pipelineStageForPhase(LeadPhase.NEW),
      createdById: admin.id,
    }
  });

  // Lead 11: Solomon Demeke (NEW - Unclaimed)
  await prisma.lead.create({
    data: {
      fullName: "Solomon Demeke",
      phoneNumber: "+251 922 34 5678",
      phoneKey: phoneKey("+251 922 34 5678"),
      email: "solomon.d@example.com",
      phase: LeadPhase.NEW,
      pipelineStage: pipelineStageForPhase(LeadPhase.NEW),
      createdById: admin.id,
    }
  });

  // Lead 14: Lidya Teshome (NEW - Unclaimed)
  await prisma.lead.create({
    data: {
      fullName: "Lidya Teshome",
      phoneNumber: "+251 925 67 8901",
      phoneKey: phoneKey("+251 925 67 8901"),
      email: "lidya.t@example.com",
      phase: LeadPhase.NEW,
      pipelineStage: pipelineStageForPhase(LeadPhase.NEW),
      createdById: admin.id,
    }
  });

  console.log("Database seeded with production admin and development mock data!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
