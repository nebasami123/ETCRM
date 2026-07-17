/**
 * Idempotent mock campaign data for local development.
 * Run: pnpm --filter etcrm-server exec tsx prisma/seed-campaigns.ts
 */
import { CampaignStatus, LeadPhase, PrismaClient } from "@prisma/client";
import { phoneKey } from "../src/features/leads/leadService.js";

const prisma = new PrismaClient();

const MOCK_PREFIX = "campaign-seed-";

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function daysAgo(days: number) {
  return daysFromNow(-days);
}

async function main() {
  const admin =
    (await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } })) ||
    (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } }));
  if (!admin) {
    throw new Error("No users found. Run the main seed first (pnpm --filter etcrm-server seed).");
  }
  const adminId = admin.id;

  const salesUsers = await prisma.user.findMany({
    where: { role: "SALES" },
    orderBy: { name: "asc" }
  });
  if (salesUsers.length < 1) {
    throw new Error("Need at least one SALES user. Run the main seed first.");
  }

  const [bekele, selam, dawit] = [
    salesUsers.find((u) => u.email.includes("sales") || u.name.toLowerCase().includes("bekele")) || salesUsers[0]!,
    salesUsers.find((u) => u.email.includes("maria") || u.name.toLowerCase().includes("selam")) ||
      salesUsers[1] ||
      salesUsers[0]!,
    salesUsers.find((u) => u.email.includes("dawit") || u.name.toLowerCase().includes("dawit")) ||
      salesUsers[2] ||
      salesUsers[0]!
  ];

  console.log(`Admin: ${admin.name} (${admin.email})`);
  console.log(`Sales: ${salesUsers.map((u) => u.name).join(", ")}`);

  // Clear previous campaign mock data (leads created by this seeder + campaigns)
  const priorCampaigns = await prisma.campaign.findMany({
    where: { OR: [{ name: { startsWith: "Q3 " } }, { label: { in: ["VIP", "Bole", "Merkato"] } }] },
    select: { id: true }
  });
  if (priorCampaigns.length) {
    await prisma.campaignLead.deleteMany({ where: { campaignId: { in: priorCampaigns.map((c) => c.id) } } });
    await prisma.campaignMember.deleteMany({ where: { campaignId: { in: priorCampaigns.map((c) => c.id) } } });
    await prisma.campaign.deleteMany({ where: { id: { in: priorCampaigns.map((c) => c.id) } } });
  }
  await prisma.lead.deleteMany({ where: { phoneKey: { startsWith: "251999" } } });

  type SeedLead = {
    fullName: string;
    phone: string;
    businessName: string;
    region: string;
    subcity: string;
    capital: number;
    phase: LeadPhase;
    owner: typeof bekele;
  };

  const highCapital: SeedLead[] = [
    {
      fullName: "Abel Mekonnen",
      phone: "+251 999 100 001",
      businessName: "Bole Capital Trading PLC",
      region: "Addis Ababa",
      subcity: "Bole",
      capital: 5_000_000,
      phase: LeadPhase.NEW,
      owner: bekele
    },
    {
      fullName: "Hanna Girma",
      phone: "+251 999 100 002",
      businessName: "Sheger Import Export",
      region: "Addis Ababa",
      subcity: "Kirkos",
      capital: 3_200_000,
      phase: LeadPhase.CONTACTED,
      owner: bekele
    },
    {
      fullName: "Yonas Haile",
      phone: "+251 999 100 003",
      businessName: "Addis Ketema Logistics",
      region: "Addis Ababa",
      subcity: "Addis Ketema",
      capital: 2_800_000,
      phase: LeadPhase.FOLLOW_UP,
      owner: selam
    },
    {
      fullName: "Marta Tadesse",
      phone: "+251 999 100 004",
      businessName: "Yeka Construction Materials",
      region: "Addis Ababa",
      subcity: "Yeka",
      capital: 4_100_000,
      phase: LeadPhase.CLOSED_WON,
      owner: selam
    },
    {
      fullName: "Samson Bekele",
      phone: "+251 999 100 005",
      businessName: "Lideta Wholesale Market",
      region: "Addis Ababa",
      subcity: "Lideta",
      capital: 1_500_000,
      phase: LeadPhase.NEW,
      owner: dawit
    },
    {
      fullName: "Rahel Getachew",
      phone: "+251 999 100 006",
      businessName: "Nifas Silk Packaging",
      region: "Addis Ababa",
      subcity: "Nifas Silk-Lafto",
      capital: 2_200_000,
      phase: LeadPhase.CLOSED_LOST,
      owner: dawit
    }
  ];

  const boleFocus: SeedLead[] = [
    {
      fullName: "Daniel Asrat",
      phone: "+251 999 200 001",
      businessName: "Bole Avenue Cafe",
      region: "Addis Ababa",
      subcity: "Bole",
      capital: 850_000,
      phase: LeadPhase.NEW,
      owner: bekele
    },
    {
      fullName: "Kidist Alemu",
      phone: "+251 999 200 002",
      businessName: "Airport Road Pharmacy",
      region: "Addis Ababa",
      subcity: "Bole",
      capital: 1_100_000,
      phase: LeadPhase.CONTACTED,
      owner: bekele
    },
    {
      fullName: "Elias Worku",
      phone: "+251 999 200 003",
      businessName: "Bole Printing Press",
      region: "Addis Ababa",
      subcity: "Bole",
      capital: 720_000,
      phase: LeadPhase.NEW,
      owner: selam
    },
    {
      fullName: "Tigist Hailu",
      phone: "+251 999 200 004",
      businessName: "Edna Mall Retail Hub",
      region: "Addis Ababa",
      subcity: "Bole",
      capital: 980_000,
      phase: LeadPhase.FOLLOW_UP,
      owner: selam
    }
  ];

  const draftOnly: SeedLead[] = [
    {
      fullName: "Placeholder Merkato 1",
      phone: "+251 999 300 001",
      businessName: "Merkato Textiles Co",
      region: "Addis Ababa",
      subcity: "Addis Ketema",
      capital: 400_000,
      phase: LeadPhase.NEW,
      owner: dawit
    }
  ];

  async function createLeadRow(row: SeedLead, index: number) {
    const pKey = phoneKey(row.phone);
    const claimedAt = daysAgo(3 + (index % 5));
    const lead = await prisma.lead.create({
      data: {
        fullName: row.fullName,
        phoneNumber: row.phone,
        phoneKey: pKey,
        email: `${MOCK_PREFIX}${pKey}@example.com`,
        phase: row.phase,
        createdById: adminId,
        claimedById: row.owner.id,
        claimedAt,
        businessName: row.businessName,
        businessRegion: row.region,
        businessWoreda: row.subcity,
        legalStatusNameEng: "PLC",
        licenceNumber: `LIC-${pKey.slice(-6)}`
      }
    });
    await prisma.leadPhoneIndex.upsert({
      where: { phoneKey: pKey },
      create: { phoneKey: pKey, kind: "LOCAL", leadId: lead.id },
      update: { kind: "LOCAL", leadId: lead.id }
    });
    return lead;
  }

  console.log("Creating mock leads for campaigns...");
  const highLeads = [];
  for (let i = 0; i < highCapital.length; i++) highLeads.push(await createLeadRow(highCapital[i]!, i));
  const boleLeads = [];
  for (let i = 0; i < boleFocus.length; i++) boleLeads.push(await createLeadRow(boleFocus[i]!, i));
  // draft-only leads are not needed as CampaignLead until launch — skip materializing draftOnly
  void draftOnly;

  const now = new Date();
  const startsActive = daysAgo(5);
  const endsActive = daysFromNow(9);

  console.log("Creating campaigns...");

  // 1) Active high-capital campaign with mixed outcomes
  const campaign1 = await prisma.campaign.create({
    data: {
      name: "Q3 High Capital Addis",
      label: "VIP",
      description: "Businesses with capital above 1M ETB across Addis Ababa.",
      status: CampaignStatus.ACTIVE,
      filters: { capitalMin: 1_000_000, region: "Addis Ababa" },
      sortMode: "capital_desc",
      durationDays: 14,
      startsAt: startsActive,
      endsAt: endsActive,
      assignedAt: startsActive,
      createdById: admin.id,
      members: {
        create: [
          { userId: bekele.id, targetCount: 2, dailyContactGoal: 8 },
          { userId: selam.id, targetCount: 2, dailyContactGoal: 8 },
          { userId: dawit.id, targetCount: 2, dailyContactGoal: 6 }
        ]
      }
    }
  });

  await prisma.campaignLead.createMany({
    data: highLeads.map((lead, i) => {
      const meta = highCapital[i]!;
      return {
        campaignId: campaign1.id,
        phoneKey: lead.phoneKey,
        phoneNumber: lead.phoneNumber,
        fullName: lead.fullName,
        businessName: lead.businessName,
        capital: meta.capital,
        region: meta.region,
        subcity: meta.subcity,
        leadId: lead.id,
        assignedToId: meta.owner.id,
        assignedAt: startsActive
      };
    })
  });

  // 2) Active Bole-focused campaign
  const campaign2 = await prisma.campaign.create({
    data: {
      name: "Bole Subcity Sprint",
      label: "Bole",
      description: "Two-week push on Bole businesses for the field team.",
      status: CampaignStatus.ACTIVE,
      filters: { region: "Addis Ababa", subcity: "Bole" },
      sortMode: "capital_desc",
      durationDays: 14,
      startsAt: daysAgo(2),
      endsAt: daysFromNow(12),
      assignedAt: daysAgo(2),
      createdById: admin.id,
      members: {
        create: [
          { userId: bekele.id, targetCount: 2, dailyContactGoal: 10 },
          { userId: selam.id, targetCount: 2, dailyContactGoal: 10 }
        ]
      }
    }
  });

  await prisma.campaignLead.createMany({
    data: boleLeads.map((lead, i) => {
      const meta = boleFocus[i]!;
      return {
        campaignId: campaign2.id,
        phoneKey: lead.phoneKey,
        phoneNumber: lead.phoneNumber,
        fullName: lead.fullName,
        businessName: lead.businessName,
        capital: meta.capital,
        region: meta.region,
        subcity: meta.subcity,
        leadId: lead.id,
        assignedToId: meta.owner.id,
        assignedAt: daysAgo(2)
      };
    })
  });

  // 3) Draft campaign (no leads assigned yet)
  await prisma.campaign.create({
    data: {
      name: "Merkato Wholesale Pass",
      label: "Merkato",
      description: "Draft only — filters ready, not launched.",
      status: CampaignStatus.DRAFT,
      filters: { region: "Addis Ababa", subcity: "Addis Ketema", capitalMin: 300_000 },
      sortMode: "random",
      durationDays: 7,
      createdById: admin.id,
      members: {
        create: [
          { userId: dawit.id, targetCount: 15, dailyContactGoal: 5 },
          { userId: bekele.id, targetCount: 15, dailyContactGoal: 5 }
        ]
      }
    }
  });

  // 4) Closed campaign with historical results
  const closedStarts = daysAgo(40);
  const closedEnds = daysAgo(10);
  const closedLeadsMeta: SeedLead[] = [
    {
      fullName: "Closed Campaign Lead A",
      phone: "+251 999 400 001",
      businessName: "Arada Closed Demo A",
      region: "Addis Ababa",
      subcity: "Arada",
      capital: 600_000,
      phase: LeadPhase.CLOSED_WON,
      owner: bekele
    },
    {
      fullName: "Closed Campaign Lead B",
      phone: "+251 999 400 002",
      businessName: "Arada Closed Demo B",
      region: "Addis Ababa",
      subcity: "Arada",
      capital: 550_000,
      phase: LeadPhase.CLOSED_LOST,
      owner: selam
    },
    {
      fullName: "Closed Campaign Lead C",
      phone: "+251 999 400 003",
      businessName: "Arada Closed Demo C",
      region: "Addis Ababa",
      subcity: "Arada",
      capital: 480_000,
      phase: LeadPhase.CLOSED_WON,
      owner: dawit
    }
  ];
  const closedLeads = [];
  for (let i = 0; i < closedLeadsMeta.length; i++) closedLeads.push(await createLeadRow(closedLeadsMeta[i]!, i));

  const campaign4 = await prisma.campaign.create({
    data: {
      name: "Q2 Arada Cleanup",
      label: "Arada",
      description: "Completed last month — useful for performance charts.",
      status: CampaignStatus.CLOSED,
      filters: { region: "Addis Ababa", subcity: "Arada" },
      sortMode: "capital_asc",
      durationDays: 30,
      startsAt: closedStarts,
      endsAt: closedEnds,
      assignedAt: closedStarts,
      closedAt: closedEnds,
      createdById: admin.id,
      members: {
        create: [
          { userId: bekele.id, targetCount: 1, dailyContactGoal: 5 },
          { userId: selam.id, targetCount: 1, dailyContactGoal: 5 },
          { userId: dawit.id, targetCount: 1, dailyContactGoal: 5 }
        ]
      }
    }
  });

  await prisma.campaignLead.createMany({
    data: closedLeads.map((lead, i) => {
      const meta = closedLeadsMeta[i]!;
      return {
        campaignId: campaign4.id,
        phoneKey: lead.phoneKey,
        phoneNumber: lead.phoneNumber,
        fullName: lead.fullName,
        businessName: lead.businessName,
        capital: meta.capital,
        region: meta.region,
        subcity: meta.subcity,
        leadId: lead.id,
        assignedToId: meta.owner.id,
        assignedAt: closedStarts
      };
    })
  });

  // 5) Paused campaign
  const pausedStarts = daysAgo(7);
  const pausedLeadsMeta: SeedLead[] = [
    {
      fullName: "Paused Campaign Lead A",
      phone: "+251 999 500 001",
      businessName: "Gullele Paused Demo",
      region: "Addis Ababa",
      subcity: "Gullele",
      capital: 900_000,
      phase: LeadPhase.NEW,
      owner: bekele
    },
    {
      fullName: "Paused Campaign Lead B",
      phone: "+251 999 500 002",
      businessName: "Gullele Paused Demo 2",
      region: "Addis Ababa",
      subcity: "Gullele",
      capital: 750_000,
      phase: LeadPhase.CONTACTED,
      owner: selam
    }
  ];
  const pausedLeads = [];
  for (let i = 0; i < pausedLeadsMeta.length; i++) pausedLeads.push(await createLeadRow(pausedLeadsMeta[i]!, i));

  const campaign5 = await prisma.campaign.create({
    data: {
      name: "Gullele Soft Launch",
      label: "Gullele",
      description: "Paused mid-run while filters are refined.",
      status: CampaignStatus.PAUSED,
      filters: { region: "Addis Ababa", subcity: "Gullele" },
      sortMode: "value_desc",
      durationDays: 21,
      startsAt: pausedStarts,
      endsAt: daysFromNow(14),
      assignedAt: pausedStarts,
      createdById: admin.id,
      members: {
        create: [
          { userId: bekele.id, targetCount: 1, dailyContactGoal: 4 },
          { userId: selam.id, targetCount: 1, dailyContactGoal: 4 }
        ]
      }
    }
  });

  await prisma.campaignLead.createMany({
    data: pausedLeads.map((lead, i) => {
      const meta = pausedLeadsMeta[i]!;
      return {
        campaignId: campaign5.id,
        phoneKey: lead.phoneKey,
        phoneNumber: lead.phoneNumber,
        fullName: lead.fullName,
        businessName: lead.businessName,
        capital: meta.capital,
        region: meta.region,
        subcity: meta.subcity,
        leadId: lead.id,
        assignedToId: meta.owner.id,
        assignedAt: pausedStarts
      };
    })
  });

  const summary = await prisma.campaign.findMany({
    select: {
      name: true,
      status: true,
      label: true,
      durationDays: true,
      _count: { select: { leads: true, members: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  console.log("\nCampaign mock data ready:");
  for (const row of summary) {
    console.log(
      `  [${row.status}] ${row.name} (${row.label || "—"}) — ${row._count.leads} leads, ${row._count.members} agents, ${row.durationDays}d`
    );
  }
  console.log(`\nSeeded at ${now.toISOString()}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
