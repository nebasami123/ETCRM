import type { FormEvent } from "react";
import type { LeadFormState, UserSummary } from "../../../types";

interface LeadFormProps {
  newLead: LeadFormState;
  salesUsers?: UserSummary[];
  updateNewLead: (field: keyof LeadFormState, value: string) => void;
  createLead: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  showAssignment?: boolean;
  showAppointment?: boolean;
  sectionClassName?: string;
  formClassName?: string;
  buttonClassName?: string;
}

export function LeadForm({
  newLead,
  salesUsers = [],
  updateNewLead,
  createLead,
  showAssignment = false,
  showAppointment = false,
  sectionClassName = "mt-6 rounded-lg border border-line bg-white p-5 shadow-soft",
  formClassName = "mt-4 grid gap-3 md:grid-cols-4",
  buttonClassName = "rounded bg-forest px-4 py-2 font-semibold text-white md:col-span-4"
}: LeadFormProps) {
  return (
    <section className={sectionClassName}>
      <h2 className="text-lg font-bold">Add Lead Manually</h2>
      <form onSubmit={createLead} className={formClassName}>
        <input value={newLead.fullName} onChange={(event) => updateNewLead("fullName", event.target.value)} required placeholder="Full name or business" className="rounded border border-line px-3 py-2" />
        <input value={newLead.phoneNumber} onChange={(event) => updateNewLead("phoneNumber", event.target.value)} required placeholder="Phone number" className="rounded border border-line px-3 py-2" />
        <input value={newLead.email} onChange={(event) => updateNewLead("email", event.target.value)} placeholder="Email" className="rounded border border-line px-3 py-2" />
        {showAppointment ? (
          <input type="datetime-local" value={newLead.appointmentDate} onChange={(event) => updateNewLead("appointmentDate", event.target.value)} className="rounded border border-line px-3 py-2" />
        ) : null}
        {showAssignment ? (
          <select value={newLead.assignedToId} onChange={(event) => updateNewLead("assignedToId", event.target.value)} className="rounded border border-line px-3 py-2">
            <option value="">Unassigned</option>
            {salesUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        ) : null}
        <input value={newLead.businessName} onChange={(event) => updateNewLead("businessName", event.target.value)} placeholder="Business name" className="rounded border border-line px-3 py-2" />
        <input value={newLead.licenceNumber} onChange={(event) => updateNewLead("licenceNumber", event.target.value)} placeholder="License number" className="rounded border border-line px-3 py-2" />
        <input value={newLead.businessRegion} onChange={(event) => updateNewLead("businessRegion", event.target.value)} placeholder="Region" className="rounded border border-line px-3 py-2" />
        <input value={newLead.businessWoreda} onChange={(event) => updateNewLead("businessWoreda", event.target.value)} placeholder="Woreda" className="rounded border border-line px-3 py-2" />
        <button className={buttonClassName}>Add Lead</button>
      </form>
    </section>
  );
}
