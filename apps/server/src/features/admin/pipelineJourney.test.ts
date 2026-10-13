import { describe, expect, it } from "vitest";
import { buildPipelineJourney } from "./pipelineJourney.js";

const lead = (pipelineStage: string, id = "one", kind = "LOCAL") => ({ id, kind, pipelineStage, phase: "FOLLOW_UP", leadSource: "Customer referral" });
const event = (pipelineStage: string, fromPipelineStage?: string, leadId = "one", leadKind = "LOCAL") => ({ leadId, leadKind, metadata: { pipelineStage, fromPipelineStage }, fromPhase: null, toPhase: null });
const counts = (result: ReturnType<typeof buildPipelineJourney>) => Object.fromEntries(result.pipelineCounts.map((row) => [row.stage, row.count]));

describe("recorded pipeline journey", () => {
  it("keeps won leads in earlier recorded stages without inventing skipped steps or double-counting updates", () => {
    const result = buildPipelineJourney([lead("Closed Won")], [
      event("Contacted", "Lead"), event("Contacted", "Contacted"),
      event("Proposal", "Contacted"), event("Closed Won", "Proposal")
    ], 0);
    expect(counts(result)).toEqual({ Lead: 1, Contacted: 1, "Meeting Booked": 0, "Showed Up": 0, "Demo / Presentation": 0, Proposal: 1, Negotiation: 0, "Closed Won": 1 });
    expect(result.pipelineSources[0].stages.find((row) => row.stage === "Contacted")).toEqual({ stage: "Contacted", count: 1, currentCount: 0, progressedCount: 1 });
  });

  it("retains progress after backward moves and losses without a Closed Lost column", () => {
    const result = buildPipelineJourney([lead("Contacted", "back"), lead("Closed Lost")], [
      event("Contacted", "Proposal", "back"), event("Closed Lost", "Contacted")
    ], 0);
    expect(counts(result)).toMatchObject({ Lead: 2, Contacted: 2, Proposal: 1, "Closed Won": 0 });
    expect(counts(result)).not.toHaveProperty("Closed Lost");
  });

  it("separates identical IDs across lead tables and ignores events for missing leads", () => {
    const result = buildPipelineJourney([lead("Lead"), lead("Lead", "one", "REGISTRY")], [event("Proposal"), event("Closed Won", undefined, "deleted")], 3);
    expect(counts(result)).toMatchObject({ Lead: 5, Proposal: 1, "Closed Won": 0 });
    expect(result.pipelineSources.find((row) => row.source === "Internal lead pool")?.stages[0].count).toBe(3);
  });

  it("uses precise legacy phases and current stages while marking unavailable history", () => {
    const result = buildPipelineJourney([lead("Closed Won"), lead("Proposal", "missing")], [
      { leadId: "one", leadKind: "LOCAL", metadata: null, fromPhase: "CONTACTED", toPhase: "CLOSED_WON" },
      { leadId: "missing", leadKind: "LOCAL", metadata: {}, fromPhase: "FOLLOW_UP", toPhase: "FOLLOW_UP" }
    ], 0);
    expect(counts(result)).toMatchObject({ Lead: 2, Contacted: 1, "Meeting Booked": 0, Proposal: 1, "Closed Won": 1 });
    expect(result.pipelineSources[0].historyUnavailable).toBe(1);
  });
});
