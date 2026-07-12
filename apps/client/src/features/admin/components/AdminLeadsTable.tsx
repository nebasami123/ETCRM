import { useState } from "react";
import { formatDate } from "../../../utils/format";
import type { Lead, LeadFilters, LeadPhase, UserSummary } from "../../../types";
import { phaseOptions } from "../../../utils/format";
import { AdminLeadFilters } from "./AdminLeadFilters";

interface AdminLeadsTableProps {
  leads: Lead[];
  salesUsers: UserSummary[];
  leadFilters: LeadFilters;
  updateLeadFilter: (field: keyof LeadFilters, value: string) => void;
  assignLead: (leadId: string, salesUserId: string) => Promise<void>;
  updateLeadPhase: (leadId: string, phase: LeadPhase, creditedUserId?: string) => Promise<void>;
}

export function AdminLeadsTable({ leads, salesUsers, leadFilters, updateLeadFilter, assignLead, updateLeadPhase }: AdminLeadsTableProps) {
  const [conversionCredits, setConversionCredits] = useState<Record<string, string>>({});
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
              <th className="px-5 py-3">Claimed by</th>
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
                  <select value={lead.phase} onChange={(event) => updateLeadPhase(lead.id, event.target.value as LeadPhase, event.target.value === "CLOSED_WON" ? conversionCredits[lead.id] : undefined)} className="min-w-32 rounded border border-line px-2 py-1">
                    {phaseOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <select value={conversionCredits[lead.id] || ""} onChange={(event) => setConversionCredits((current) => ({ ...current, [lead.id]: event.target.value }))} className="mt-2 w-full rounded border border-line px-2 py-1 text-xs" aria-label={`Conversion credit for ${lead.fullName}`}>
                    <option value="">Conversion credit…</option>
                    {salesUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                  </select>
                </td>
                <td className="px-5 py-3">
                  <select
                    value={lead.claimedBy?.id || ""}
                    onChange={(event) => assignLead(lead.id, event.target.value)}
                    className="min-w-36 rounded border border-line px-2 py-1"
                  >
                    <option value="">Unclaimed</option>
                    {salesUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-3">{lead.createdBy?.name || "-"}</td>
                <td className="px-5 py-3">{formatDate(lead.appointmentDate)}</td>
                <td className="px-5 py-3">{formatDate(lead.nextFollowUpAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
