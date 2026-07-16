import { LeadPhase } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { updateSalesLeadPhase } from "./salesCommands.js";

describe("updateSalesLeadPhase (sales path)", () => {
  it("rejects CLOSED_WON without calling the workflow (no admin conversion credit)", async () => {
    const result = await updateSalesLeadPhase({
      leadId: "any-lead-id",
      userId: "any-sales-user",
      phase: LeadPhase.CLOSED_WON
    });
    expect(result).toEqual({ status: "closed-won-forbidden" });
  });
});
