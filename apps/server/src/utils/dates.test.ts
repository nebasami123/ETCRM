import { describe, expect, it } from "vitest";
import { businessDate, endOfBusinessDay, startOfBusinessDay, taskWindow } from "./dates.js";

describe("Addis Ababa business-day boundaries", () => {
  it("uses Africa/Addis_Ababa rather than the host timezone", () => {
    const value = new Date("2026-07-11T22:30:00.000Z");
    expect(businessDate(value)).toBe("2026-07-12");
    expect(endOfBusinessDay(value).getTime() - startOfBusinessDay(value).getTime()).toBe(86_399_999);
  });

  it("taskWindow today matches business day start/end", () => {
    const now = new Date();
    const window = taskWindow("today");
    expect(window.gte?.getTime()).toBe(startOfBusinessDay(now).getTime());
    expect(window.lte?.getTime()).toBe(endOfBusinessDay(now).getTime());
  });

  it("taskWindow custom uses business-day bounds for the given dates", () => {
    const window = taskWindow("custom", "2026-07-01", "2026-07-03");
    expect(window.gte?.getTime()).toBe(startOfBusinessDay(new Date("2026-07-01T12:00:00.000Z")).getTime());
    expect(window.lte?.getTime()).toBe(endOfBusinessDay(new Date("2026-07-03T12:00:00.000Z")).getTime());
  });

  it("taskWindow lifetime is unbounded", () => {
    expect(taskWindow("lifetime")).toEqual({});
  });
});
