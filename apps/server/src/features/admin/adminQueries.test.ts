import { describe, expect, it, vi } from "vitest";

vi.mock("../../config/db.js", () => ({ prisma: {
  lead: { findMany: vi.fn(async () => [
    ...Array.from({ length: 3 }, (_, i) => ({ id: `l${i}`, pipelineStage: "Lead", phase: "NEW", leadSource: "Customer referral" })),
    ...Array.from({ length: 2 }, (_, i) => ({ id: `w${i}`, pipelineStage: "legacy", phase: "CLOSED_WON", leadSource: null }))
  ]), groupBy: vi.fn(async ({ by }: { by: string[] }) => by.includes("pipelineStage") ? [
    { pipelineStage: "Lead", phase: "NEW", leadSource: "Customer referral", _count: { _all: 3 } },
    { pipelineStage: "legacy", phase: "CLOSED_WON", leadSource: null, _count: { _all: 2 } }
  ] : by.includes("claimedById") ? [] : [
    { phase: "NEW", _count: { _all: 3 } }, { phase: "CLOSED_WON", _count: { _all: 2 } }
  ]) },
  registryLead: { findMany: vi.fn(async () => Array.from({ length: 4 }, (_, i) => ({ id: `r${i}`, pipelineStage: "Contacted", phase: "CONTACTED", leadSource: null }))), groupBy: vi.fn(async ({ by }: { by: string[] }) => by.includes("pipelineStage") ? [
    { pipelineStage: "Contacted", phase: "CONTACTED", leadSource: null, _count: { _all: 4 } }
  ] : by.includes("claimedById") ? [] : [{ phase: "CONTACTED", _count: { _all: 4 } }]) },
  activityEvent: { findMany: vi.fn(async () => [{ leadId: "w0", leadKind: "LOCAL", metadata: { pipelineStage: "Contacted" }, fromPhase: "NEW", toPhase: "CONTACTED" }]), groupBy: vi.fn(async () => []) },
  user: { findMany: vi.fn(async () => []) }
} }));
vi.mock("../registry/registryService.js", () => ({ getRegistrySummary: vi.fn(async () => ({ totalBusinesses: 20, available: true })) }));

import { getAdminOverviewAggregates } from "./adminQueries.js";
import { getRegistrySummary } from "../registry/registryService.js";

describe("pipeline source aggregates", () => {
  it("accounts for every stage, phase fallback, unknown source, and unclaimed directory lead", async () => {
    const result = await getAdminOverviewAggregates();
    for (const row of result.pipelineCounts) {
      expect(result.pipelineSources.reduce((sum, source) => sum + source.stages.find((stage) => stage.stage === row.stage)!.count, 0)).toBe(row.count);
    }
    expect(result.pipelineSources.find((source) => source.source === "Internal lead pool")?.stages.find((row) => row.stage === "Lead")?.count).toBe(15);
    expect(result.pipelineSources.find((source) => source.source === "Unknown / not recorded")?.stages.find((row) => row.stage === "Closed Won")?.count).toBe(2);
    expect(result.pipelineCounts.find((row) => row.stage === "Lead")?.count).toBe(20);
    expect(result.pipelineCounts.find((row) => row.stage === "Contacted")?.count).toBe(5);
    expect(result.pipelineCounts.map((row) => row.stage)).not.toContain("Closed Lost");
    vi.mocked(getRegistrySummary).mockRejectedValueOnce(new Error("Directory offline"));
    const offline = await getAdminOverviewAggregates();
    expect(offline.pipelineCounts.find((row) => row.stage === "Lead")?.count).toBe(9);
  });
});
