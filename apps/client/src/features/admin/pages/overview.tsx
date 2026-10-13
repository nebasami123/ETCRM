import { useAdminOverview } from "../hooks/use-admin-overview";
import { KPICard } from "../../../components/ui/kpi-card";
import { BarChart } from "../../../components/charts/bar-chart";
import { PipelineChart } from "../../../components/charts/pipeline-chart";
import { DonutChart } from "../../../components/charts/donut-chart";
import { LoadingSkeleton } from "../../../components/ui/loading-skeleton";
import { LeaderboardTable } from "../../../components/ui/leaderboard-table";
import { Card } from "../../../components/ui/card";
import type { ActivityType } from "../../../types";
const activityMeta: Array<{ type: ActivityType; label: string; fill: string }> = [
  { type: "CALL_NOTE", label: "Calls", fill: "var(--accent)" },
  { type: "PHASE_CHANGED", label: "Stage updates", fill: "var(--accent)" },
  { type: "LEAD_CREATED", label: "New Leads", fill: "var(--success)" },
  { type: "FOLLOW_UP_SET", label: "Follow-Ups", fill: "var(--warning)" },
  { type: "LEAD_UPDATED", label: "Detail edits", fill: "var(--muted)" },
  { type: "LEAD_CLAIMED", label: "Claims", fill: "var(--accent)" }
];

export function AdminOverview() {
  const { summary, aggregates, leaderboard, isLoading, loadError, refresh } = useAdminOverview();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton type="card" count={4} />
        <LoadingSkeleton type="table" count={5} />
      </div>
    );
  }

  if (loadError) {
    return (
      <Card className="crm-card p-8 text-center">
        <h2 className="text-base font-medium text-foreground">Dashboard data is unavailable</h2>
        <p className="mt-1 text-sm text-muted">Check the connection and try loading the overview again.</p>
        <button type="button" onClick={() => refresh()} className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
          Try again
        </button>
      </Card>
    );
  }

  const totalWon = leaderboard.reduce((sum, e) => sum + e.conversions, 0);
  const totalLost = leaderboard.reduce((sum, e) => sum + e.losses, 0);
  const totalInProgress = leaderboard.reduce((sum, e) => sum + e.inProgress, 0);
  const conversionBase = totalWon + totalLost + totalInProgress;
  const winRate = conversionBase ? Math.round((totalWon / conversionBase) * 100) : 0;

  const agentOutcomeData = (aggregates?.agentOutcomes ?? [])
    .slice(0, 8)
    .map((row) => ({
      name: row.name,
      won: row.won,
      lost: row.lost,
      pending: row.pending
    }));

  const activityData = activityMeta
    .map((t) => ({
      name: t.label,
      value: aggregates?.activityMix.find((row) => row.type === t.type)?.count ?? 0,
      fill: t.fill
    }))
    .filter((item) => item.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Welcome back, Admin</h2>
        <p className="text-xs text-muted mt-1">How your team is doing across the full pipeline.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard label="Total leads" value={summary?.leads ?? 0} tone="accent" />
        <KPICard label="Sales agents" value={summary?.salesUsers ?? 0} tone="default" />
        <KPICard label="Closed won" value={summary?.won ?? 0} tone="success" />
        <KPICard label="Overall win rate" value={`${winRate}%`} tone="success" />
        <KPICard label="Pending transfers" value={summary?.pendingTransfers ?? 0} tone="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-3">
          <PipelineChart sources={aggregates?.pipelineSources ?? []} />
        </div>

        <Card className="crm-card min-w-0 overflow-hidden p-5">
          <h3 className="text-base font-medium text-foreground">Activity distribution</h3>
          <p className="text-[11px] text-muted mt-1 mb-3">Types of actions across the full activity log.</p>
          <div className="flex min-h-64 w-full flex-col">
            {activityData.length > 0 ? (
              <>
                <div className="relative mx-auto h-44 w-full max-w-[220px] shrink-0 overflow-visible">
                  <DonutChart data={activityData} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                  {activityData.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5 border border-separator rounded-lg px-2 py-1 bg-default/10">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                      <span className="truncate text-muted">{item.name}</span>
                      <span className="font-extrabold text-foreground ml-auto">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-xs text-muted">No activities logged yet</div>
            )}
          </div>
        </Card>

      <Card className="crm-card min-w-0 overflow-hidden p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-medium text-foreground">Agent lead outcomes</h3>
              <p className="text-[11px] text-muted mt-1">Won, lost, and pending (open pipeline) leads by assigned agent.</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success" /> Won
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-danger" /> Lost
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-warning" /> Pending
              </span>
            </div>
          </div>
          <div className="h-64 w-full">
            {agentOutcomeData.length > 0 ? (
              <BarChart
                data={agentOutcomeData}
                xKey="name"
                yKeys={["won", "lost", "pending"]}
                yLabels={{ won: "Won", lost: "Lost", pending: "Pending" }}
                colors={["var(--success)", "var(--danger)", "var(--warning)"]}
                layout="vertical"
                stacked
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted">No agents registered</div>
            )}
          </div>
        </Card>
      </div>

      <Card className="crm-card min-w-0 overflow-hidden p-5">
        <h3 className="text-base font-medium text-foreground">Sales leaderboard</h3>
        <p className="text-[11px] text-muted mt-1 mb-4">Rankings by conversion count and contact activity (DB aggregates).</p>
        <LeaderboardTable data={leaderboard} />
      </Card>
    </div>
  );
}

export default AdminOverview;
