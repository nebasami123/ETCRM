import type { SalesDashboardData } from "../../../types";

function ProgressBar({ value, max }: { value: number; max: number }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{value} completed</span>
        <span>{max} target</span>
      </div>
      <div className="h-3 overflow-hidden rounded bg-neutral-100">
        <div className="h-full rounded bg-forest transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function QuotaProgress({ dashboard }: { dashboard: SalesDashboardData | null }) {
  return (
    <div>
      <h2 className="text-lg font-bold">Today&apos;s Quota</h2>
      <div className="mt-4 space-y-4">
        <ProgressBar value={dashboard?.progress.callsCompleted || 0} max={dashboard?.quota.callsTarget || 0} />
        <ProgressBar value={dashboard?.progress.leadsProcessed || 0} max={dashboard?.quota.leadsTarget || 0} />
      </div>
    </div>
  );
}
