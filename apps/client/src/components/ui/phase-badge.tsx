import { Badge } from "../arc/badge/badge";
import type { LeadPhase } from "../../types";
import { phaseLabels } from "../../lib/utils/format";

interface PhaseBadgeProps {
  phase: LeadPhase;
  className?: string;
}

const phaseTones: Record<LeadPhase, "neutral" | "success" | "info" | "warning" | "danger"> = {
  NEW: "info",
  CONTACTED: "neutral",
  FOLLOW_UP: "warning",
  N_A: "neutral",
  CLOSED_WON: "success",
  CLOSED_LOST: "danger"
};

export function PhaseBadge({ phase, className }: PhaseBadgeProps) {
  return <Badge tone={phaseTones[phase]} size="sm" className={className}>{phaseLabels[phase]}</Badge>;
}
