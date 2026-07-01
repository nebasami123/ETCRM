import { phaseOptions } from "../../../utils/format";
import type { LeadFilters, UserSummary } from "../../../types";

interface AdminLeadFiltersProps {
  leadFilters: LeadFilters;
  salesUsers: UserSummary[];
  updateLeadFilter: (field: keyof LeadFilters, value: string) => void;
}

export function AdminLeadFilters({ leadFilters, salesUsers, updateLeadFilter }: AdminLeadFiltersProps) {
  return (
    <div className="grid gap-3 border-b border-line p-5 md:grid-cols-4">
      <input
        value={leadFilters.search}
        onChange={(event) => updateLeadFilter("search", event.target.value)}
        placeholder="Search name, phone, license, location"
        className="rounded border border-line px-3 py-2"
      />
      <select value={leadFilters.phase} onChange={(event) => updateLeadFilter("phase", event.target.value)} className="rounded border border-line px-3 py-2">
        <option value="ALL">All phases</option>
        {phaseOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <select value={leadFilters.assignedToId} onChange={(event) => updateLeadFilter("assignedToId", event.target.value)} className="rounded border border-line px-3 py-2">
        <option value="">All assignments</option>
        <option value="UNASSIGNED">Unassigned</option>
        {salesUsers.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
      <select value={leadFilters.createdById} onChange={(event) => updateLeadFilter("createdById", event.target.value)} className="rounded border border-line px-3 py-2">
        <option value="">Created by anyone</option>
        {salesUsers.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
    </div>
  );
}
