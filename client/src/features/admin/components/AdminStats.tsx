import { StatCard } from "../../../components/ui/StatCard";
import type { AdminSummary } from "../../../types";

export function AdminStats({ summary }: { summary: AdminSummary | null }) {
  return (
    <div className="grid gap-4 md:grid-cols-7">
      <StatCard label="Total Leads" value={summary?.leads ?? "-"} tone="forest" />
      <StatCard label="Sales Agents" value={summary?.salesUsers ?? "-"} />
      <StatCard label="Follow-Ups" value={summary?.followUps ?? "-"} />
      <StatCard label="Closed Won" value={summary?.won ?? "-"} tone="gold" />
      <StatCard label="Closed Lost" value={summary?.lost ?? "-"} tone="coral" />
      <StatCard label="Unassigned" value={summary?.unassigned ?? "-"} />
      <StatCard label="Sales Added Today" value={summary?.salesCreatedToday ?? "-"} />
    </div>
  );
}
