import type { DateValue, LeadPhase } from "../../types";

export const phaseLabels: Record<LeadPhase, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  FOLLOW_UP: "Follow-Up",
  N_A: "N/A",
  CLOSED_WON: "Closed-Won",
  CLOSED_LOST: "Closed-Lost"
};

export const phaseOptions = (Object.entries(phaseLabels) as Array<[LeadPhase, string]>).map(([value, label]) => ({ value, label }));

export function todayInputValue() {
  const date = new Date();
  return date.toISOString().slice(0, 10);
}

export function formatDate(value: DateValue) {
  if (!value) return "None";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

/** Format capital / money with thousand separators (e.g. 30,000,000,000,000). */
export function formatCapital(value?: number | string | null) {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

export function formatDateTime(value: DateValue) {
  if (!value) return "None";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function toDateTimeLocalValue(value: DateValue) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** Safely extracts a human-readable message from an unknown catch-block error,
 *  including Axios-style `{ response: { data: { message } } }` errors. */
export function getErrorMessage(err: unknown, fallback = "An error occurred"): string {
  if (typeof err === "object" && err !== null) {
    const e = err as Record<string, unknown>;
    const responseData = (e.response as Record<string, unknown> | undefined)?.data;
    if (typeof responseData === "object" && responseData !== null) {
      const msg = (responseData as Record<string, unknown>).message;
      if (typeof msg === "string" && msg) return msg;
    }
    if (typeof e.message === "string" && e.message) return e.message;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}
