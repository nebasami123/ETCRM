import { Save } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { LeadPhase } from "../../../types";
import { phaseOptions } from "../../../utils/format";

interface PhaseEditorProps {
  phase: LeadPhase;
  setPhase: Dispatch<SetStateAction<LeadPhase>>;
  onSave: () => Promise<void>;
}

export function PhaseEditor({ phase, setPhase, onSave }: PhaseEditorProps) {
  return (
    <div>
      <label className="text-sm font-semibold">Phase</label>
      <div className="mt-2 flex gap-2">
        <select value={phase} onChange={(event) => setPhase(event.target.value as LeadPhase)} className="min-w-0 flex-1 rounded border border-line px-3 py-2">
          {phaseOptions.filter((option) => option.value !== "CLOSED_WON").map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button onClick={onSave} className="inline-flex items-center gap-2 rounded bg-ink px-4 py-2 font-semibold text-white">
          <Save size={17} />
          Save
        </button>
      </div>
    </div>
  );
}
