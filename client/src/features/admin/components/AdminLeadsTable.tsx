import { Badge } from "../../../components/ui/Badge";
import { formatDate } from "../../../utils/format";
import type { Lead, LeadFilters, UserSummary } from "../../../types";
import { AdminLeadFilters } from "./AdminLeadFilters";

interface AdminLeadsTableProps {
  leads: Lead[];
  salesUsers: UserSummary[];
  leadFilters: LeadFilters;
  updateLeadFilter: (field: keyof LeadFilters, value: string) => void;
  assignLead: (leadId: string, salesUserId: string) => Promise<void>;
}

export function AdminLeadsTable({ leads, salesUsers, leadFilters, updateLeadFilter, assignLead }: AdminLeadsTableProps) {
  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-line bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-line p-5">
        <div>
          <h2 className="text-lg font-bold">Recent Leads</h2>
          <span className="text-sm text-neutral-500">{leads.length} shown</span>
        </div>
      </div>
      <AdminLeadFilters leadFilters={leadFilters} salesUsers={salesUsers} updateLeadFilter={updateLeadFilter} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-5 py-3">Lead</th>
              <th className="px-5 py-3">Phone</th>
              <th className="px-5 py-3">License</th>
              <th className="px-5 py-3">Region</th>
              <th className="px-5 py-3">Phase</th>
              <th className="px-5 py-3">Assigned</th>
              <th className="px-5 py-3">Created By</th>
              <th className="px-5 py-3">Appointment</th>
              <th className="px-5 py-3">Follow-Up</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-t border-line">
                <td className="px-5 py-3">
                  <p className="font-semibold">{lead.fullName}</p>
                  <p className="text-neutral-500">{lead.email}</p>
                </td>
                <td className="px-5 py-3">{lead.phoneNumber}</td>
                <td className="px-5 py-3">{lead.licenceNumber || "-"}</td>
                <td className="px-5 py-3">{lead.businessRegion || "-"}</td>
                <td className="px-5 py-3">
                  <Badge phase={lead.phase} />
                </td>
                <td className="px-5 py-3">
                  <select
                    value={lead.assignedTo?.id || ""}
                    onChange={(event) => assignLead(lead.id, event.target.value)}
                    className="min-w-36 rounded border border-line px-2 py-1"
                  >
                    <option value="">Unassigned</option>
                    {salesUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-3">{lead.createdBy?.name || "-"}</td>
                <td className="px-5 py-3">{formatDate(lead.appointmentDate)}</td>
                <td className="px-5 py-3">{formatDate(lead.followUpDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
