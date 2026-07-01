import { CheckCircle2 } from "lucide-react";
import { formatDateTime } from "../../../utils/format";
import type { CallNote } from "../../../types";

export function CallHistory({ callNotes }: { callNotes: CallNote[] }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-lg font-bold">
        <CheckCircle2 size={19} />
        Call History
      </h3>
      <div className="mt-3 space-y-3">
        {callNotes.length ? (
          callNotes.map((callNote) => (
            <div key={callNote.id} className="rounded border border-line p-3">
              <div className="flex items-center justify-between gap-3 text-xs text-neutral-500">
                <span>{callNote.agent.name}</span>
                <span>{formatDateTime(callNote.createdAt)}</span>
              </div>
              <p className="mt-2 text-sm leading-6">{callNote.note}</p>
            </div>
          ))
        ) : (
          <p className="rounded border border-dashed border-line p-5 text-sm text-neutral-500">No call notes yet.</p>
        )}
      </div>
    </div>
  );
}
