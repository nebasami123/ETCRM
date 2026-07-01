import { StatCard } from "../../../components/ui/StatCard";
import type { SalesDashboardData } from "../../../types";

export function SalesStats({ dashboard }: { dashboard: SalesDashboardData | null }) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <StatCard label="Call Target" value={dashboard?.quota.callsTarget ?? "-"} tone="forest" />
      <StatCard label="Calls Made" value={dashboard?.progress.callsCompleted ?? "-"} />
      <StatCard label="Lead Target" value={dashboard?.quota.leadsTarget ?? "-"} tone="gold" />
      <StatCard label="Leads Processed" value={dashboard?.progress.leadsProcessed ?? "-"} />
    </div>
  );
}
