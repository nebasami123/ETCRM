/**
 * Official administrative subcities of Addis Ababa (11 total).
 * Sources: Addis Ababa City Administration / commonly cited municipal divisions.
 * Lemi Kura is the 11th subcity (established ~2020).
 *
 * Used to filter noisy Mongo subcity values that mix woredas, other regions, etc.
 */
export const ADDIS_ABABA_SUBCITIES = [
  "Addis Ketema",
  "Akaky Kaliti",
  "Arada",
  "Bole",
  "Gullele",
  "Kirkos",
  "Kolfe Keranio",
  "Lideta",
  "Nifas Silk-Lafto",
  "Yeka",
  "Lemi Kura"
] as const;

/** Normalized keys → canonical display name */
const ADDIS_SUBCITY_ALIASES: Record<string, string> = {
  addisketema: "Addis Ketema",
  "addis ketema": "Addis Ketema",
  akakykaliti: "Akaky Kaliti",
  "akaky kaliti": "Akaky Kaliti",
  akakikaliti: "Akaky Kaliti",
  "akaki kaliti": "Akaky Kaliti",
  "akaki kality": "Akaky Kaliti",
  "akaky kality": "Akaky Kaliti",
  "akaki-kality": "Akaky Kaliti",
  arada: "Arada",
  bole: "Bole",
  gullele: "Gullele",
  gulele: "Gullele",
  kirkos: "Kirkos",
  "kolfe keranio": "Kolfe Keranio",
  "kolfe keraneo": "Kolfe Keranio",
  kolfekeranio: "Kolfe Keranio",
  lideta: "Lideta",
  "nifas silk-lafto": "Nifas Silk-Lafto",
  "nifas silk lafto": "Nifas Silk-Lafto",
  "nifas silk": "Nifas Silk-Lafto",
  nifassilklafto: "Nifas Silk-Lafto",
  yeka: "Yeka",
  "lemi kura": "Lemi Kura",
  lemikura: "Lemi Kura"
};

export function isAddisAbabaRegion(region?: string | null) {
  const key = String(region || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return key === "addisababa" || key === "addisabeba" || key === "aa";
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Keep only values that match known Addis Ababa subcities (do not invent new options). */
export function filterAddisSubcities(options: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of options) {
    const key = normalizeKey(raw);
    const compact = key.replace(/[^a-z]/g, "");
    const canonical =
      ADDIS_SUBCITY_ALIASES[key] ||
      ADDIS_SUBCITY_ALIASES[compact] ||
      ADDIS_ABABA_SUBCITIES.find((name) => normalizeKey(name) === key || normalizeKey(name).replace(/[^a-z]/g, "") === compact);
    if (!canonical || seen.has(canonical)) continue;
    // Only include if the raw option already existed in data (user asked not to add missing ones).
    seen.add(canonical);
    // Prefer the spelling already present in the data list when close enough.
    result.push(raw.trim());
  }
  return result.sort((a, b) => a.localeCompare(b));
}
