import type { LeadPhase } from "../../types";
import { phaseLabels } from "../../lib/utils/format";

interface PhaseBadgeProps {
  phase: LeadPhase;
  className?: string;
}

const phaseColors: Record<LeadPhase, string> = {
  NEW: "bg-accent/10 border-accent/20 text-accent",
  CONTACTED: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
  FOLLOW_UP: "bg-warning/10 border-warning/20 text-warning",
  N_A: "bg-muted/20 border-border text-muted",
  CLOSED_WON: "bg-success/10 border-success/20 text-success",
  CLOSED_LOST: "bg-danger/10 border-danger/20 text-danger"
};

export function PhaseBadge({ phase, className = "" }: PhaseBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-normal uppercase transition-colors duration-200 ${phaseColors[phase]} ${className}`}
    >
      {phaseLabels[phase]}
    </span>
  );
}
