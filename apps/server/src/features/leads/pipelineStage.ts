import { LeadPhase } from "@prisma/client";
import { salesPipelineStages } from "@etcrm/contracts";

export { salesPipelineStages };

export type SalesPipelineStage = (typeof salesPipelineStages)[number];

export function pipelineStageForPhaseChange(phase: LeadPhase, currentStage: string): SalesPipelineStage {
  if (phase === LeadPhase.FOLLOW_UP || phase === LeadPhase.N_A) {
    // These phases do not establish a meeting or another specific milestone.
    return salesPipelineStages.includes(currentStage as SalesPipelineStage)
      && currentStage !== "Closed Won" && currentStage !== "Closed Lost"
      ? currentStage as SalesPipelineStage : "Lead";
  }
  return pipelineStageForPhase(phase);
}

export function phaseForPipelineStage(stage: SalesPipelineStage): LeadPhase {
  if (stage === "Lead") return LeadPhase.NEW;
  if (stage === "Contacted") return LeadPhase.CONTACTED;
  if (stage === "Closed Won") return LeadPhase.CLOSED_WON;
  if (stage === "Closed Lost") return LeadPhase.CLOSED_LOST;
  return LeadPhase.FOLLOW_UP;
}

export function pipelineStageForPhase(phase: LeadPhase): SalesPipelineStage {
  switch (phase) {
    case LeadPhase.NEW: return "Lead";
    case LeadPhase.CONTACTED: return "Contacted";
    case LeadPhase.CLOSED_WON: return "Closed Won";
    case LeadPhase.CLOSED_LOST: return "Closed Lost";
    case LeadPhase.FOLLOW_UP:
    case LeadPhase.N_A: return "Meeting Booked";
  }
}
