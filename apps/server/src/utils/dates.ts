import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { env } from "../config/env.js";

export const businessTimeZone = env.BUSINESS_TIME_ZONE;

export function businessDate(value: Date = new Date()) {
  return formatInTimeZone(value, businessTimeZone, "yyyy-MM-dd");
}

export function startOfBusinessDay(value: Date = new Date()) {
  return fromZonedTime(`${businessDate(value)}T00:00:00.000`, businessTimeZone);
}

export function endOfBusinessDay(value: Date = new Date()) {
  return new Date(startOfBusinessDay(value).getTime() + 86_400_000 - 1);
}

export function parseBusinessDate(value: unknown = undefined) {
  const date = typeof value === "string" ? value : businessDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Expected a YYYY-MM-DD business date");
  // A date column must retain this calendar day independently of its host timezone.
  return new Date(`${date}T12:00:00.000Z`);
}

export function parseOptionalDate(value: unknown) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

/**
 * Build a half-open [start, end) window in the business timezone for planner/task filters.
 * Aligns with startOfBusinessDay / endOfBusinessDay used by the sales dashboard.
 */
export function taskWindow(range: string, start?: string, end?: string): { gte?: Date; lte?: Date; lt?: Date } {
  if (range === "lifetime") return {};

  if (range === "custom" && start && end) {
    const from = startOfBusinessDay(new Date(`${start}T12:00:00.000Z`));
    const to = endOfBusinessDay(new Date(`${end}T12:00:00.000Z`));
    return { gte: from, lte: to };
  }

  const now = new Date();
  const dayStart = startOfBusinessDay(now);

  if (range === "week") {
    const weekEnd = endOfBusinessDay(new Date(dayStart.getTime() + 6 * 86_400_000));
    return { gte: dayStart, lte: weekEnd };
  }
  if (range === "month") {
    // Add ~30 calendar days in business TZ by stepping from dayStart
    const monthEnd = endOfBusinessDay(new Date(dayStart.getTime() + 29 * 86_400_000));
    return { gte: dayStart, lte: monthEnd };
  }

  // today (default)
  return { gte: dayStart, lte: endOfBusinessDay(now) };
}
