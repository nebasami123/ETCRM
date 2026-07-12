import { describe, expect, it } from "vitest";
import { businessDate, endOfBusinessDay, startOfBusinessDay } from "./dates.js";

describe("Addis Ababa business-day boundaries", () => {
  it("uses Africa/Addis_Ababa rather than the host timezone", () => {
    const value = new Date("2026-07-11T22:30:00.000Z");
    expect(businessDate(value)).toBe("2026-07-12");
    expect(endOfBusinessDay(value).getTime() - startOfBusinessDay(value).getTime()).toBe(86_399_999);
  });
});
