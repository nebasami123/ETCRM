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
