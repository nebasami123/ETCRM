import { LeadPhase, ActivityType } from "@prisma/client";
import { auth } from "../src/auth/auth.js";
import { prisma } from "../src/config/db.js";
import { parseBusinessDate } from "../src/utils/dates.js";
import { phoneKey } from "../src/features/leads/leadService.js";

async function createUser(input: { name: string; email: string; password: string; role: "ADMIN" | "SALES" }) {
  const result = await auth.api.createUser({
    body: {
      ...input,
      role: input.role as never
    }
  });
  return result.user;
}

async function main() {
  console.log("Wiping existing database records...");
  
  // Wipe database in order of dependencies
  await prisma.activityEvent.deleteMany({});
  await prisma.claimTransferRequest.deleteMany({});
  await prisma.quota.deleteMany({});
  await prisma.campaignLead.deleteMany({});
  await prisma.campaignMember.deleteMany({});
  await prisma.campaign.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.verification.deleteMany({});

  console.log("Seeding Ethiopian users...");
  
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
  
  const followUpToday = new Date();
  followUpToday.setUTCHours(9, 0, 0, 0);

  const followUpTomorrow = new Date();
  followUpTomorrow.setDate(followUpTomorrow.getDate() + 1);
  followUpTomorrow.setUTCHours(10, 0, 0, 0);

  const followUpNextWeek = new Date();
  followUpNextWeek.setDate(followUpNextWeek.getDate() + 7);
  followUpNextWeek.setUTCHours(14, 30, 0, 0);

  const appointmentInTwoDays = new Date();
  appointmentInTwoDays.setDate(appointmentInTwoDays.getDate() + 2);
  appointmentInTwoDays.setUTCHours(11, 0, 0, 0);

  // Lead 1: Mulugeta Tesfaye (CLOSED_WON by Bekele)
  const lead1 = await prisma.lead.create({
    data: {
      fullName: "Mulugeta Tesfaye",
      phoneNumber: "+251 911 12 3456",
      phoneKey: phoneKey("+251 911 12 3456"),
      email: "mulugeta.tesfaye@example.com",
      phase: LeadPhase.CLOSED_WON,
      createdById: bekele.id,
      claimedById: bekele.id,
      claimedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      businessName: "Bole Cafe & Restaurant",
      legalStatusNameEng: "PLC",
      businessRegion: "Addis Ababa",
      businessZone: "Bole",
      businessWoreda: "03",
      businessKebele: "02"
    }
  });

  await prisma.activityEvent.createMany({
    data: [
      {
        leadId: lead1.id,
        actorId: bekele.id,
        type: ActivityType.LEAD_CREATED,
        note: "Lead created from inbound walk-in.",
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead1.id,
        actorId: bekele.id,
        type: ActivityType.LEAD_CLAIMED,
        note: "Claimed lead for active sales engagement.",
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead1.id,
        actorId: bekele.id,
        type: ActivityType.CALL_NOTE,
        note: "Spoke with Mulugeta. Extremely interested in setting up a modern POS integration for his cafe.",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead1.id,
        actorId: bekele.id,
        type: ActivityType.PHASE_CHANGED,
        fromPhase: LeadPhase.NEW,
        toPhase: LeadPhase.CONTACTED,
        note: "Contact established.",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead1.id,
        actorId: bekele.id,
        type: ActivityType.PHASE_CHANGED,
        fromPhase: LeadPhase.CONTACTED,
        toPhase: LeadPhase.CLOSED_WON,
        creditedUserId: bekele.id,
        note: "Contract signed! Paid for 1-year enterprise package.",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      }
    ]
  });

  // Lead 2: Genet Abebe (FOLLOW_UP by Bekele)
  const lead2 = await prisma.lead.create({
    data: {
      fullName: "Genet Abebe",
      phoneNumber: "+251 912 23 4567",
      phoneKey: phoneKey("+251 912 23 4567"),
      email: "genet.abebe@example.com",
      phase: LeadPhase.FOLLOW_UP,
      createdById: bekele.id,
      claimedById: bekele.id,
      claimedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      nextFollowUpAt: followUpTomorrow,
      businessName: "Awash Coffee Exporters",
      legalStatusNameEng: "Sole Proprietorship",
      businessRegion: "Addis Ababa",
      businessZone: "Kirkos"
    }
  });

  await prisma.activityEvent.createMany({
    data: [
      {
        leadId: lead2.id,
        actorId: bekele.id,
        type: ActivityType.LEAD_CREATED,
        note: "Imported via coffee industry directory listing.",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead2.id,
        actorId: bekele.id,
        type: ActivityType.LEAD_CLAIMED,
        note: "Claimed lead.",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead2.id,
        actorId: bekele.id,
        type: ActivityType.PHASE_CHANGED,
        fromPhase: LeadPhase.NEW,
        toPhase: LeadPhase.CONTACTED,
        note: "Discussed bulk supply workflows over phone.",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead2.id,
        actorId: bekele.id,
        type: ActivityType.PHASE_CHANGED,
        fromPhase: LeadPhase.CONTACTED,
        toPhase: LeadPhase.FOLLOW_UP,
        note: "Genet asked to follow up tomorrow once she reviews the price catalog.",
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000)
      },
      {
        leadId: lead2.id,
        actorId: bekele.id,
        type: ActivityType.FOLLOW_UP_SET,
        note: "Follow up scheduled for tomorrow morning.",
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000)
      }
    ]
  });

  // Lead 3: Tewodros Kassahun (CONTACTED by Selamawit)
  const lead3 = await prisma.lead.create({
    data: {
      fullName: "Tewodros Kassahun",
      phoneNumber: "+251 913 34 5678",
      phoneKey: phoneKey("+251 913 34 5678"),
      email: "teddy.k@example.com",
      phase: LeadPhase.CONTACTED,
      createdById: selam.id,
      claimedById: selam.id,
      claimedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      appointmentDate: appointmentInTwoDays,
      businessName: "Sheger Tech Solutions",
      legalStatusNameEng: "Share Company",
      businessRegion: "Addis Ababa",
      businessZone: "Yeka"
    }
  });

  await prisma.activityEvent.createMany({
    data: [
      {
        leadId: lead3.id,
        actorId: selam.id,
        type: ActivityType.LEAD_CREATED,
        note: "Inquiry received via website form.",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead3.id,
        actorId: selam.id,
        type: ActivityType.LEAD_CLAIMED,
        note: "Claimed lead.",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead3.id,
        actorId: selam.id,
        type: ActivityType.PHASE_CHANGED,
        fromPhase: LeadPhase.NEW,
        toPhase: LeadPhase.CONTACTED,
        note: "Called Tewodros. Scheduled formal presentation/appointment.",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead3.id,
        actorId: selam.id,
        type: ActivityType.APPOINTMENT_SET,
        note: "Meeting scheduled at their HQ in Yeka.",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      }
    ]
  });

  // Lead 4: Frehiwot Kebede (NEW under Selamawit)
  const lead4 = await prisma.lead.create({
    data: {
      fullName: "Frehiwot Kebede",
      phoneNumber: "+251 914 45 6789",
      phoneKey: phoneKey("+251 914 45 6789"),
      email: "frehiwot.k@example.com",
      phase: LeadPhase.NEW,
      createdById: selam.id,
      claimedById: selam.id,
      claimedAt: new Date(),
      businessName: "Entoto Souvenirs",
      businessRegion: "Addis Ababa",
      businessZone: "Gullele"
    }
  });

  await prisma.activityEvent.create({
    data: {
      leadId: lead4.id,
      actorId: selam.id,
      type: ActivityType.LEAD_CREATED,
      note: "Created manually after phone discovery."
    }
  });
  await prisma.activityEvent.create({
    data: {
      leadId: lead4.id,
      actorId: selam.id,
      type: ActivityType.LEAD_CLAIMED,
      note: "Claimed lead automatically upon creation."
    }
  });

  // Lead 5: Abdi Ibrahim (NEW under Dawit)
  const lead5 = await prisma.lead.create({
    data: {
      fullName: "Abdi Ibrahim",
      phoneNumber: "+251 915 56 7890",
      phoneKey: phoneKey("+251 915 56 7890"),
      email: "abdi.ibrahim@example.com",
      phase: LeadPhase.NEW,
      createdById: dawit.id,
      claimedById: dawit.id,
      claimedAt: new Date(),
      businessName: "Merkato Spice Traders",
      businessRegion: "Addis Ababa",
      businessZone: "Addis Ketema"
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

  // Lead 6: Zenebech Tolosa (CLOSED_LOST by Dawit)
  const lead6 = await prisma.lead.create({
    data: {
      fullName: "Zenebech Tolosa",
      phoneNumber: "+251 916 67 8901",
      phoneKey: phoneKey("+251 916 67 8901"),
      email: "zenebech.t@example.com",
      phase: LeadPhase.CLOSED_LOST,
      createdById: dawit.id,
      claimedById: dawit.id,
      claimedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      businessName: "Lake Tana Fish Market",
      businessRegion: "Amhara",
      businessZone: "Bahir Dar"
    }
  });

  await prisma.activityEvent.createMany({
    data: [
      {
        leadId: lead6.id,
        actorId: dawit.id,
        type: ActivityType.LEAD_CREATED,
        note: "Created during local outreach in Bahir Dar.",
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead6.id,
        actorId: dawit.id,
        type: ActivityType.LEAD_CLAIMED,
        note: "Claimed lead.",
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead6.id,
        actorId: dawit.id,
        type: ActivityType.PHASE_CHANGED,
        fromPhase: LeadPhase.NEW,
        toPhase: LeadPhase.CONTACTED,
        note: "Spoke to Zenebech. They currently do not have internet/reliable power for electronic registers.",
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead6.id,
        actorId: dawit.id,
        type: ActivityType.PHASE_CHANGED,
        fromPhase: LeadPhase.CONTACTED,
        toPhase: LeadPhase.CLOSED_LOST,
        note: "Closed lost. Business infrastructure does not meet prerequisites.",
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
      }
    ]
  });

  // Lead 7: Haile Selassie (CONTACTED by Bekele)
  const lead7 = await prisma.lead.create({
    data: {
      fullName: "Haile Selassie",
      phoneNumber: "+251 917 78 9012",
      phoneKey: phoneKey("+251 917 78 9012"),
      email: "haile.s@example.com",
      phase: LeadPhase.CONTACTED,
      createdById: bekele.id,
      claimedById: bekele.id,
      claimedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      businessName: "Gonder Tour Guides",
      businessRegion: "Amhara",
      businessZone: "Gondar"
    }
  });

  await prisma.activityEvent.createMany({
    data: [
      {
        leadId: lead7.id,
        actorId: bekele.id,
        type: ActivityType.LEAD_CREATED,
        note: "Lead created.",
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead7.id,
        actorId: bekele.id,
        type: ActivityType.LEAD_CLAIMED,
        note: "Claimed lead.",
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead7.id,
        actorId: bekele.id,
        type: ActivityType.PHASE_CHANGED,
        fromPhase: LeadPhase.NEW,
        toPhase: LeadPhase.CONTACTED,
        note: "Contacted Haile. Interested in SMS marketing features for tourist announcements.",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      }
    ]
  });

  // Lead 8: Betty Girmay (NEW under Selamawit)
  await prisma.lead.create({
    data: {
      fullName: "Betty Girmay",
      phoneNumber: "+251 918 89 0123",
      phoneKey: phoneKey("+251 918 89 0123"),
      email: "betty.g@example.com",
      phase: LeadPhase.NEW,
      createdById: selam.id,
      claimedById: selam.id,
      claimedAt: new Date(),
      businessName: "Lalibela Stone Carvings",
      businessRegion: "Amhara",
      businessZone: "Lalibela"
    }
  });

  // Lead 9: Tariku Melese (FOLLOW_UP under Dawit)
  const lead9 = await prisma.lead.create({
    data: {
      fullName: "Tariku Melese",
      phoneNumber: "+251 920 12 3456",
      phoneKey: phoneKey("+251 920 12 3456"),
      email: "tariku.m@example.com",
      phase: LeadPhase.FOLLOW_UP,
      createdById: dawit.id,
      claimedById: dawit.id,
      claimedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      nextFollowUpAt: followUpNextWeek,
      businessName: "Rift Valley Agricultural Cooperative",
      businessRegion: "Oromia",
      businessZone: "East Shoa"
    }
  });

  await prisma.activityEvent.createMany({
    data: [
      {
        leadId: lead9.id,
        actorId: dawit.id,
        type: ActivityType.LEAD_CREATED,
        note: "Created during farmers cooperative trade expo.",
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead9.id,
        actorId: dawit.id,
        type: ActivityType.LEAD_CLAIMED,
        note: "Claimed lead.",
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead9.id,
        actorId: dawit.id,
        type: ActivityType.PHASE_CHANGED,
        fromPhase: LeadPhase.NEW,
        toPhase: LeadPhase.CONTACTED,
        note: "Spoke to Tariku. Discussed bulk procurement notification pipelines.",
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead9.id,
        actorId: dawit.id,
        type: ActivityType.PHASE_CHANGED,
        fromPhase: LeadPhase.CONTACTED,
        toPhase: LeadPhase.FOLLOW_UP,
        note: "Tariku requested a follow-up next week after the next harvest budget meeting.",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead9.id,
        actorId: dawit.id,
        type: ActivityType.FOLLOW_UP_SET,
        note: "Follow up set.",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      }
    ]
  });

  // Lead 10: Kidist Weldemariam (NEW - Unclaimed)
  await prisma.lead.create({
    data: {
      fullName: "Kidist Weldemariam",
      phoneNumber: "+251 921 23 4567",
      phoneKey: phoneKey("+251 921 23 4567"),
      email: "kidist.w@example.com",
      phase: LeadPhase.NEW,
      createdById: admin.id,
      businessName: "Meskel Square Boutique",
      businessRegion: "Addis Ababa",
      businessZone: "Kirkos"
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
      createdById: admin.id,
      businessName: "Unity Park Bakery",
      businessRegion: "Addis Ababa",
      businessZone: "Arada"
    }
  });

  // Lead 12: Rahel Assefa (CLOSED_WON under Selamawit)
  const lead12 = await prisma.lead.create({
    data: {
      fullName: "Rahel Assefa",
      phoneNumber: "+251 923 45 6789",
      phoneKey: phoneKey("+251 923 45 6789"),
      email: "rahel.a@example.com",
      phase: LeadPhase.CLOSED_WON,
      createdById: selam.id,
      claimedById: selam.id,
      claimedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      businessName: "Piassa Jewelry Workshop",
      legalStatusNameEng: "Sole Proprietorship",
      businessRegion: "Addis Ababa",
      businessZone: "Arada"
    }
  });

  await prisma.activityEvent.createMany({
    data: [
      {
        leadId: lead12.id,
        actorId: selam.id,
        type: ActivityType.LEAD_CREATED,
        note: "Referral from another customer.",
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead12.id,
        actorId: selam.id,
        type: ActivityType.LEAD_CLAIMED,
        note: "Claimed lead.",
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead12.id,
        actorId: selam.id,
        type: ActivityType.PHASE_CHANGED,
        fromPhase: LeadPhase.NEW,
        toPhase: LeadPhase.CONTACTED,
        note: "Met at Piassa workshop. Walked through system configuration.",
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead12.id,
        actorId: selam.id,
        type: ActivityType.PHASE_CHANGED,
        fromPhase: LeadPhase.CONTACTED,
        toPhase: LeadPhase.CLOSED_WON,
        creditedUserId: selam.id,
        note: "Successfully signed up. Active user.",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      }
    ]
  });

  // Lead 13: Kidus Girma (CONTACTED under Dawit)
  const lead13 = await prisma.lead.create({
    data: {
      fullName: "Kidus Girma",
      phoneNumber: "+251 924 56 7890",
      phoneKey: phoneKey("+251 924 56 7890"),
      email: "kidus.g@example.com",
      phase: LeadPhase.CONTACTED,
      createdById: dawit.id,
      claimedById: dawit.id,
      claimedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      businessName: "Hasa Logistics & Delivery",
      businessRegion: "Oromia",
      businessZone: "Finfinne"
    }
  });

  await prisma.activityEvent.createMany({
    data: [
      {
        leadId: lead13.id,
        actorId: dawit.id,
        type: ActivityType.LEAD_CREATED,
        note: "Outbound lead generation.",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead13.id,
        actorId: dawit.id,
        type: ActivityType.LEAD_CLAIMED,
        note: "Claimed lead.",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead13.id,
        actorId: dawit.id,
        type: ActivityType.PHASE_CHANGED,
        fromPhase: LeadPhase.NEW,
        toPhase: LeadPhase.CONTACTED,
        note: "Contacted Kidus. He is reviewing the logistics tracking module demo.",
        createdAt: new Date()
      }
    ]
  });

  // Lead 14: Lidya Teshome (NEW - Unclaimed)
  await prisma.lead.create({
    data: {
      fullName: "Lidya Teshome",
      phoneNumber: "+251 925 67 8901",
      phoneKey: phoneKey("+251 925 67 8901"),
      email: "lidya.t@example.com",
      phase: LeadPhase.NEW,
      createdById: admin.id,
      businessName: "Red Sea Shipping Agency",
      businessRegion: "Addis Ababa",
      businessZone: "Lideta"
    }
  });

  // Lead 15: Fikru Abera (CLOSED_LOST under Bekele)
  const lead15 = await prisma.lead.create({
    data: {
      fullName: "Fikru Abera",
      phoneNumber: "+251 926 78 9012",
      phoneKey: phoneKey("+251 926 78 9012"),
      email: "fikru.a@example.com",
      phase: LeadPhase.CLOSED_LOST,
      createdById: bekele.id,
      claimedById: bekele.id,
      claimedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      businessName: "Semien Mountains Ecolodge",
      businessRegion: "Amhara",
      businessZone: "North Gondar"
    }
  });

  await prisma.activityEvent.createMany({
    data: [
      {
        leadId: lead15.id,
        actorId: bekele.id,
        type: ActivityType.LEAD_CREATED,
        note: "Created from tourist agency inquiry.",
        createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead15.id,
        actorId: bekele.id,
        type: ActivityType.LEAD_CLAIMED,
        note: "Claimed lead.",
        createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead15.id,
        actorId: bekele.id,
        type: ActivityType.PHASE_CHANGED,
        fromPhase: LeadPhase.NEW,
        toPhase: LeadPhase.CONTACTED,
        note: "Called Fikru. He reported that they are currently using a custom satellite system and do not require CRM integration.",
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      },
      {
        leadId: lead15.id,
        actorId: bekele.id,
        type: ActivityType.PHASE_CHANGED,
        fromPhase: LeadPhase.CONTACTED,
        toPhase: LeadPhase.CLOSED_LOST,
        note: "Closed lost. No current requirement or budget.",
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      }
    ]
  });

  console.log(`Database seeded successfully! Admin: ${admin.name} (${admin.email})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
