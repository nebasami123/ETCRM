import { PhoneCall } from "lucide-react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Badge } from "../../../components/ui/Badge";
import type { Lead, LeadPhase } from "../../../types";
import { formatDateTime } from "../../../utils/format";
import { AppointmentEditor } from "./AppointmentEditor";
import { CallHistory } from "./CallHistory";
import { PhaseEditor } from "./PhaseEditor";

interface LeadDetailPanelProps {
  activeLead: Lead | null;
  phase: LeadPhase;
  setPhase: Dispatch<SetStateAction<LeadPhase>>;
  appointmentDate: string;
  setAppointmentDate: Dispatch<SetStateAction<string>>;
  note: string;
  setNote: Dispatch<SetStateAction<string>>;
  savePhase: () => Promise<void>;
  saveAppointment: () => Promise<void>;
  addNote: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  extraFields: Array<[string, string]>;
}

export function LeadDetailPanel({
  activeLead,
  phase,
  setPhase,
  appointmentDate,
  setAppointmentDate,
  note,
  setNote,
  savePhase,
  saveAppointment,
  addNote,
  extraFields
}: LeadDetailPanelProps) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      {activeLead ? (
        <>
          <div className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">{activeLead.fullName}</h2>
              <p className="text-neutral-500">{activeLead.email}</p>
              <p className="mt-1 font-semibold">{activeLead.phoneNumber}</p>
              {activeLead.appointmentDate ? <p className="mt-1 text-sm text-forest">Appointment: {formatDateTime(activeLead.appointmentDate)}</p> : null}
              <p className="mt-1 text-xs text-neutral-500">Assigned: {activeLead.assignedTo?.name || "Unassigned"} - Created by: {activeLead.createdBy?.name || "-"}</p>
            </div>
            <Badge phase={activeLead.phase} />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-5">
              <PhaseEditor phase={phase} setPhase={setPhase} onSave={savePhase} />
              <AppointmentEditor appointmentDate={appointmentDate} setAppointmentDate={setAppointmentDate} onSave={saveAppointment} />

              {extraFields.length ? (
                <div>
                  <h3 className="text-sm font-semibold">Extra Lead Fields</h3>
                  <div className="mt-2 grid gap-2 rounded border border-line p-3 text-sm">
                    {extraFields.map(([label, value]) => (
                      <div key={label} className="grid gap-1 sm:grid-cols-[120px_1fr]">
                        <span className="text-neutral-500">{label}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <form onSubmit={addNote}>
                <label className="text-sm font-semibold">New Call Note</label>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={7}
                  className="mt-2 w-full resize-none rounded border border-line px-3 py-2 outline-none focus:border-forest"
                  placeholder="Summarize the call outcome, objections, next steps, or follow-up timing."
                />
                <button className="mt-3 inline-flex items-center gap-2 rounded bg-forest px-4 py-2 font-semibold text-white">
                  <PhoneCall size={18} />
                  Add Call Note
                </button>
              </form>
            </div>

            <CallHistory callNotes={activeLead.callNotes || []} />
          </div>
        </>
      ) : (
        <p className="text-neutral-500">Select a lead to view details.</p>
      )}
    </section>
  );
}
