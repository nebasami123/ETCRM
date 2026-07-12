import { phaseLabels } from "../../utils/format";
import type { LeadPhase } from "../../types";

const styles = {
  NEW: "border-sky-200 bg-sky-50 text-sky-800",
  CONTACTED: "border-amber-200 bg-amber-50 text-amber-800",
  FOLLOW_UP: "border-violet-200 bg-violet-50 text-violet-800",
  CLOSED_WON: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CLOSED_LOST: "border-rose-200 bg-rose-50 text-rose-800"
};

export function Badge({ phase }: { phase: LeadPhase }) {
  return <span className={`inline-flex rounded border px-2 py-1 text-xs font-semibold shadow-[0_3px_10px_rgba(15,63,52,0.06)] ${styles[phase] || styles.NEW}`}>{phaseLabels[phase] || phase}</span>;
}
