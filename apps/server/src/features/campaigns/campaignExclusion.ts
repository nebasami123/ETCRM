import { CampaignStatus, LeadPhase } from "@prisma/client";
import { prisma } from "../../config/db.js";

/**
 * Phones that must not enter a new campaign:
 * - already claimed in CRM (local or registry shell)
 * - already past NEW
 * - already sitting in another ACTIVE or PAUSED campaign
 */
export async function getExcludedPhoneKeys() {
  const [localWorked, registryWorked, activeCampaignPhones] = await Promise.all([
    prisma.lead.findMany({
      where: {
        OR: [{ claimedById: { not: null } }, { phase: { not: LeadPhase.NEW } }]
      },
      select: { phoneKey: true }
    }),
    prisma.registryLead.findMany({
      where: {
        OR: [{ claimedById: { not: null } }, { phase: { not: LeadPhase.NEW } }]
      },
      select: { phoneKey: true }
    }),
    prisma.campaignLead.findMany({
      where: {
        campaign: { status: { in: [CampaignStatus.ACTIVE, CampaignStatus.PAUSED] } }
      },
      select: { phoneKey: true }
    })
  ]);

  const set = new Set<string>();
  for (const row of localWorked) set.add(row.phoneKey);
  for (const row of registryWorked) set.add(row.phoneKey);
  for (const row of activeCampaignPhones) set.add(row.phoneKey);
  return set;
}
