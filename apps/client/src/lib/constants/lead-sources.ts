export const leadSources = [
  "Facebook / Instagram — paid ad",
  "Internal lead pool",
  "TikTok — paid ad",
  "Facebook / Instagram — organic",
  "TikTok — organic",
  "Customer referral",
  "Employee / agent referral",
  "Walk-in",
  "Website / online form",
  "Existing customer / cross-sell",
  "Other",
  "Unknown / not recorded"
] as const;

export type LeadSourceOption = typeof leadSources[number];

export const leadSourceOptions = leadSources.map((source) => ({ value: source, label: source }));

export function normalizeLeadSource(value?: string | null): { source: string; detail: string } {
  const source = value?.trim() ?? "";
  if (!source) return { source: "", detail: "" };
  if (leadSources.includes(source as LeadSourceOption)) return { source, detail: "" };

  const normalized = source.toLocaleLowerCase();
  if (/facebook|instagram/.test(normalized)) {
    const paid = /paid|ad(?:vert)?s?\b/.test(normalized);
    return { source: paid ? leadSources[0] : leadSources[3], detail: "" };
  }
  if (/tiktok/.test(normalized)) {
    const paid = /paid|ad(?:vert)?s?\b/.test(normalized);
    return { source: paid ? leadSources[2] : leadSources[4], detail: "" };
  }
  if (/walk[ -]?in/.test(normalized)) return { source: leadSources[7], detail: "" };
  if (/internal|claim queue|lead pool/.test(normalized)) return { source: leadSources[1], detail: "" };
  if (/google|website|web form|online form/.test(normalized)) return { source: leadSources[8], detail: "" };
  if (/customer referral|referred by customer/.test(normalized)) return { source: leadSources[5], detail: "" };
  if (/employee|agent referral|staff referral/.test(normalized)) return { source: leadSources[6], detail: "" };
  if (/existing customer|cross[ -]?sell|upsell/.test(normalized)) return { source: leadSources[9], detail: "" };
  if (/unknown|not recorded|n\/a/.test(normalized)) return { source: leadSources[11], detail: "" };

  return { source: leadSources[10], detail: source };
}
