import type { CampaignSortMode } from "../registry/registryService.js";
import type { RegistryFilters } from "../registry/registryTypes.js";

export type CampaignFiltersSnapshot = Pick<
  RegistryFilters,
  "region" | "subcity" | "sector" | "nationality" | "businessType" | "capitalMin" | "capitalMax" | "scoreMin" | "scoreMax"
>;

export type CampaignAllocationInput = {
  userId: string;
  count: number;
  /** Daily leads-to-contact goal while campaign is active (planner). */
  dailyContactGoal?: number;
};

export type CreateCampaignInput = {
  name: string;
  label?: string | null;
  description?: string | null;
  filters?: CampaignFiltersSnapshot;
  sortMode?: CampaignSortMode;
  /** Planned campaign length in days (e.g. 7, 14, 30). */
  durationDays?: number;
  allocations?: CampaignAllocationInput[];
};

export type LaunchCampaignInput = {
  campaignId: string;
  adminId: string;
  /** Override draft allocations at launch time. */
  allocations?: CampaignAllocationInput[];
  filters?: CampaignFiltersSnapshot;
  sortMode?: CampaignSortMode;
};

export const CAMPAIGN_SORT_MODES = [
  "capital_desc",
  "capital_asc",
  "value_desc",
  "value_asc",
  "random"
] as const satisfies readonly CampaignSortMode[];
