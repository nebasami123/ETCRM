import { describe, expect, it } from "vitest";
import { leadInputSchema, salesPipelineStages } from "@etcrm/contracts";
import { phaseForPipelineStage, pipelineStageForPhaseChange } from "./pipelineStage.js";

describe("sales pipeline stages", () => {
  it("does not invent a meeting for generic follow-up or N/A phase changes", () => {
    for (const phase of ["FOLLOW_UP", "N_A"] as const) {
      expect(pipelineStageForPhaseChange(phase, "Lead")).toBe("Lead");
      expect(pipelineStageForPhaseChange(phase, "Contacted")).toBe("Contacted");
      expect(pipelineStageForPhaseChange(phase, "Proposal")).toBe("Proposal");
      expect(pipelineStageForPhaseChange(phase, "Closed Lost")).toBe("Lead");
    }
    expect(pipelineStageForPhaseChange("CLOSED_WON", "Proposal")).toBe("Closed Won");
  });
  it("moves directly from Showed Up to Demo / Presentation and rejects the retired stage", () => {
    expect(salesPipelineStages).toEqual([
      "Lead", "Contacted", "Meeting Booked", "Showed Up", "Demo / Presentation",
      "Proposal", "Negotiation", "Closed Won", "Closed Lost"
    ]);
    const lead = { fullName: "Test Lead", phoneNumber: "+251911123456" };
    expect(leadInputSchema.safeParse({ ...lead, pipelineStage: "Qualified" }).success).toBe(false);
    expect(leadInputSchema.safeParse({ ...lead, pipelineStage: "Demo / Presentation" }).success).toBe(true);
    expect(phaseForPipelineStage("Demo / Presentation")).toBe("FOLLOW_UP");
  });
});
