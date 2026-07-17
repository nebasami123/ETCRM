import { useAdminOverview } from "../hooks/use-admin-overview";
import { KPICard } from "../../../components/ui/kpi-card";
import { BarChart } from "../../../components/charts/bar-chart";
import { DonutChart } from "../../../components/charts/donut-chart";
import { LoadingSkeleton } from "../../../components/ui/loading-skeleton";
import { LeaderboardTable } from "../../../components/ui/leaderboard-table";
import { Card } from "../../../components/ui/card";
import { phaseLabels } from "../../../lib/utils/format";
import type { ActivityType, LeadPhase } from "../../../types";

const phaseColors: Record<LeadPhase, string> = {
  NEW: "var(--accent)",
  CONTACTED: "#3b82f6",
  FOLLOW_UP: "var(--warning)",
  N_A: "var(--muted)",
  CLOSED_WON: "var(--success)",
  CLOSED_LOST: "var(--danger)"
};

const activityMeta: Array<{ type: ActivityType; label: string; fill: string }> = [
  { type: "CALL_NOTE", label: "Calls", fill: "var(--accent)" },
  { type: "PHASE_CHANGED", label: "Stage Updates", fill: "#3b82f6" },
  { type: "LEAD_CREATED", label: "New Leads", fill: "var(--success)" },
  { type: "FOLLOW_UP_SET", label: "Follow-Ups", fill: "var(--warning)" },
  { type: "LEAD_UPDATED", label: "Detail edits", fill: "#94a3b8" },
  { type: "LEAD_CLAIMED", label: "Claims", fill: "#8b5cf6" }
];

export function AdminOverview() {
  const { summary, aggregates, leaderboard, isLoading } = useAdminOverview();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton type="card" count={4} />
        <LoadingSkeleton type="table" count={5} />
      </div>
    );
  }

  const conversionBase = (summary?.won || 0) + (summary?.lost || 0);
  const winRate = conversionBase ? Math.round(((summary?.won || 0) / conversionBase) * 100) : 0;

  const phaseData = (Object.keys(phaseLabels) as LeadPhase[]).map((phase) => ({
    name: phaseLabels[phase],
    value: aggregates?.phaseCounts.find((row) => row.phase === phase)?.count ?? 0,
    fill: phaseColors[phase]
  }));

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
        <KPICard label="Total Leads" value={summary?.leads ?? 0} tone="accent" />
        <KPICard label="Sales Agents" value={summary?.salesUsers ?? 0} tone="default" />
        <KPICard label="Closed Won" value={summary?.won ?? 0} tone="success" />
        <KPICard label="Overall Win Rate" value={`${winRate}%`} tone="success" />
        <KPICard label="Pending Transfers" value={summary?.pendingTransfers ?? 0} tone="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth lg:col-span-2"
          style={{ "--card-glow": "var(--accent)" } as React.CSSProperties}
        >
          <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-accent/3 opacity-0 group-hover:opacity-100 blur-xl pointer-events-none group-hover:scale-170 transition-all duration-500 ease-out-smooth" />
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Pipeline Shape</h3>
          <p className="text-[11px] text-muted mt-1 mb-4">
            How many leads sit in each stage of the pipeline.
          </p>
          <div className="h-64 w-full">
            {phaseData.some((p) => p.value > 0) ? (
              <BarChart
                data={phaseData}
                xKey="name"
                yKeys={["value"]}
                valueFormatter={(value) =>
                  value >= 1_000_000
                    ? `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`
                    : value >= 1_000
                      ? `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`
                      : value.toLocaleString("en-US")
                }
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted">No data available</div>
            )}
          </div>
        </Card>

        <Card
          className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth"
          style={{ "--card-glow": "#3b82f6" } as React.CSSProperties}
        >
          <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-blue-500/3 opacity-0 group-hover:opacity-100 blur-xl pointer-events-none group-hover:scale-170 transition-all duration-500 ease-out-smooth" />
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Activity Distribution</h3>
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

        <Card
          className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth lg:col-span-3"
          style={{ "--card-glow": "var(--success)" } as React.CSSProperties}
        >
          <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-success/3 opacity-0 group-hover:opacity-100 blur-xl pointer-events-none group-hover:scale-170 transition-all duration-500 ease-out-smooth" />
          <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Agent Lead Outcomes</h3>
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

      <Card
        className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth"
        style={{ "--card-glow": "var(--success)" } as React.CSSProperties}
      >
        <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-success/3 opacity-0 group-hover:opacity-100 blur-xl pointer-events-none group-hover:scale-170 transition-all duration-500 ease-out-smooth" />
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Sales Leaderboard</h3>
        <p className="text-[11px] text-muted mt-1 mb-4">Rankings by conversion count and contact activity (DB aggregates).</p>
        <LeaderboardTable data={leaderboard} />
      </Card>
    </div>
  );
}

export default AdminOverview;
