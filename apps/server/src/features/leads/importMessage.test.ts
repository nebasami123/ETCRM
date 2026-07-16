import { describe, expect, it } from "vitest";
import { importEmptyMessage } from "./leadWorkflowService.js";
import { paginationSchema, leadInputSchema } from "@etcrm/contracts";

describe("importEmptyMessage", () => {
  it("summarizes skip reasons from shipped helper", () => {
    const message = importEmptyMessage({
      skipped: 5,
      skippedByReason: [
        { reason: "Missing required fields", count: 2 },
        { reason: "Already exists in CRM", count: 3 }
      ]
    });
    expect(message).toContain("All 5 rows were skipped");
    expect(message).toContain("2 Missing required fields");
    expect(message).toContain("3 Already exists in CRM");
  });
});

describe("@etcrm/contracts shared schemas", () => {
  it("parses pagination with defaults and caps", () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 50 });
    expect(paginationSchema.parse({ page: "2", pageSize: "10" })).toEqual({ page: 2, pageSize: 10 });
    expect(() => paginationSchema.parse({ pageSize: 500 })).toThrow();
  });

  it("requires lead fullName and phoneNumber", () => {
    expect(() => leadInputSchema.parse({ fullName: "", phoneNumber: "0911" })).toThrow();
    const parsed = leadInputSchema.parse({ fullName: "  Abebe  ", phoneNumber: " 0911234567 " });
    expect(parsed.fullName).toBe("Abebe");
    expect(parsed.phoneNumber).toBe("0911234567");
  });
});
