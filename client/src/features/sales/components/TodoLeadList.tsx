import { Badge } from "../../../components/ui/Badge";
import type { Dispatch, SetStateAction } from "react";
import type { Lead } from "../../../types";
import { formatDate } from "../../../utils/format";

interface TodoLeadListProps {
  visibleActiveList: Lead[];
  activeLeadId: string | null;
  setActiveLeadId: Dispatch<SetStateAction<string | null>>;
  leadSearch: string;
  setLeadSearch: Dispatch<SetStateAction<string>>;
}

export function TodoLeadList({ visibleActiveList, activeLeadId, setActiveLeadId, leadSearch, setLeadSearch }: TodoLeadListProps) {
  return (
    <section className="rounded-lg border border-line bg-white shadow-soft">
      <div className="border-b border-line p-5">
        <h2 className="text-lg font-bold">Today&apos;s To-Do List</h2>
        <p className="text-sm text-neutral-500">Appointments, follow-ups, and new assigned leads.</p>
        <input
          value={leadSearch}
          onChange={(event) => setLeadSearch(event.target.value)}
          placeholder="Search my leads"
          className="mt-3 w-full rounded border border-line px-3 py-2 text-sm"
        />
      </div>
      <div className="max-h-[680px] overflow-y-auto">
        {visibleActiveList.map((lead) => (
          <button
            key={lead.id}
            onClick={() => setActiveLeadId(lead.id)}
            className={`block w-full border-b border-line p-4 text-left hover:bg-neutral-50 ${activeLeadId === lead.id ? "bg-emerald-50" : "bg-white"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{lead.fullName}</p>
                <p className="text-sm text-neutral-500">{lead.phoneNumber}</p>
              </div>
              <Badge phase={lead.phase} />
            </div>
            <p className="mt-2 text-xs text-neutral-500">Appointment: {formatDate(lead.appointmentDate)}</p>
            <p className="text-xs text-neutral-500">Follow-up: {formatDate(lead.followUpDate)}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
