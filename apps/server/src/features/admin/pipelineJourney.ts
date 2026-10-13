import { salesPipelineStages, type SalesPipelineStage } from "../leads/pipelineStage.js";

const journeyStages = salesPipelineStages.filter((stage) => stage !== "Closed Lost");
type Lead = { id: string; kind: string; pipelineStage: string | null; phase: string; leadSource: string | null };
type StageEvent = { leadId: string | null; leadKind: string | null; metadata: unknown; fromPhase: string | null; toPhase: string | null };

function recordedStage(value: unknown): SalesPipelineStage | null {
  return typeof value === "string" && salesPipelineStages.includes(value as SalesPipelineStage) ? value as SalesPipelineStage : null;
}

// FOLLOW_UP covers several stages, so it cannot establish which one was reached.
function stageFromPhase(phase: string | null): SalesPipelineStage | null {
  switch (phase) {
    case "NEW": return "Lead";
    case "CONTACTED": return "Contacted";
    case "CLOSED_WON": return "Closed Won";
    case "CLOSED_LOST": return "Closed Lost";
    default: return null;
  }
}

export function buildPipelineJourney(leads: Lead[], events: StageEvent[], directoryCount: number) {
  const byLead = new Map(leads.map((lead) => [ `${lead.kind}:${lead.id}`, {
    lead,
    reached: new Set<SalesPipelineStage>(["Lead"]),
    current: recordedStage(lead.pipelineStage) ?? stageFromPhase(lead.phase),
    hasHistory: false
  } ]));
  for (const record of byLead.values()) {
    if (record.current && record.current !== "Closed Lost") record.reached.add(record.current);
  }
  // ponytail: one pass over selected history fields; move aggregation to SQL if history volume exceeds server memory.
  for (const event of events) {
    const record = byLead.get(`${event.leadKind}:${event.leadId}`);
    if (!record) continue;
    const metadata = event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
      ? event.metadata as Record<string, unknown> : {};
    for (const stage of [recordedStage(metadata.pipelineStage), recordedStage(metadata.fromPipelineStage), stageFromPhase(event.fromPhase), stageFromPhase(event.toPhase)]) {
      if (stage && stage !== "Lead" && stage !== "Closed Lost") record.hasHistory = true;
      if (stage && stage !== "Closed Lost") record.reached.add(stage);
    }
  }
  const sources = new Map<string, {
    source: string;
    historyUnavailable: number;
    stages: Array<{ stage: SalesPipelineStage; count: number; currentCount: number; progressedCount: number }>;
  }>();
  function sourceCounts(source: string) {
    let counts = sources.get(source);
    if (!counts) {
      counts = { source, historyUnavailable: 0, stages: journeyStages.map((stage) => ({ stage, count: 0, currentCount: 0, progressedCount: 0 })) };
      sources.set(source, counts);
    }
    return counts;
  }
  for (const { lead, reached, current, hasHistory } of byLead.values()) {
    const source = sourceCounts(lead.leadSource?.trim() || (lead.kind === "REGISTRY" ? "Internal lead pool" : "Unknown / not recorded"));
    if (current !== "Lead" && !hasHistory) source.historyUnavailable += 1;
    source.stages.forEach((row, index) => {
      if (!reached.has(row.stage)) return;
      row.count += 1;
      if (current === row.stage) row.currentCount += 1;
      if (source.stages.slice(index + 1).some(({ stage }) => reached.has(stage))) row.progressedCount += 1;
    });
  }
  if (directoryCount > 0) {
    const lead = sourceCounts("Internal lead pool").stages[0];
    lead.count += directoryCount;
    lead.currentCount += directoryCount;
  }
  const pipelineSources = [...sources.values()];
  return {
    pipelineSources,
    pipelineCounts: journeyStages.map((stage, index) => ({ stage, count: pipelineSources.reduce((sum, source) => sum + source.stages[index].count, 0) }))
  };
}
