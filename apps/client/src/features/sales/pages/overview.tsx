import { useSalesOverview } from "../hooks/use-sales-overview";
import { useSalesLeaderboard } from "../hooks/use-sales-leaderboard";
import { CircularProgress } from "../../../components/ui/circular-progress";
import { RadarChart } from "../../../components/charts/radar-chart";
import { DonutChart } from "../../../components/charts/donut-chart";
import { LoadingSkeleton } from "../../../components/ui/loading-skeleton";
import { LeaderboardTable } from "../../../components/ui/leaderboard-table";
import { phaseLabels } from "../../../lib/utils/format";
import type { LeadPhase } from "../../../types";
import { Card } from "../../../components/ui/card";
import { KPICard } from "../../../components/ui/kpi-card";

const phaseColors: Record<LeadPhase, string> = {
  NEW: "var(--accent)",
  CONTACTED: "#3b82f6",
  FOLLOW_UP: "var(--warning)",
  CLOSED_WON: "var(--success)",
  CLOSED_LOST: "var(--danger)"
};

export function SalesOverview() {
  const { dashboard, isLoading } = useSalesOverview();
  const { leaderboard, myStats, isLoading: leaderboardLoading } = useSalesLeaderboard();

  if (isLoading || leaderboardLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton type="card" count={2} />
        <LoadingSkeleton type="table" count={4} />
      </div>
    );
  }

  const callsCompleted = dashboard?.progress.callsCompleted ?? 0;
  const callsTarget = dashboard?.quota.callsTarget ?? 0;
  const leadsProcessed = dashboard?.progress.leadsProcessed ?? 0;
  const leadsTarget = dashboard?.quota.leadsTarget ?? 0;

  // Prepare Donut Chart Data
  const phaseData = (Object.keys(phaseLabels) as LeadPhase[]).map((phase) => {
    const count = dashboard?.phaseCounts.find((item) => item.phase === phase)?._count.phase ?? 0;
    return {
      name: phaseLabels[phase],
      value: count,
      fill: phaseColors[phase]
    };
  }).filter((item) => item.value > 0);

  // Helper to calculate percentages
  const percent = (val: number, max: number) => {
    if (max <= 0) return 0;
    return Math.min(100, Math.round((val / max) * 100));
  };

  // Prepare Radar Data (Calls, Leads, Queue size, Won percentage, Follow-up volumes)
  const radarData = [
    { metric: "Calls %", score: percent(callsCompleted, callsTarget) },
    { metric: "Leads %", score: percent(leadsProcessed, leadsTarget) },
    { metric: "Queue Size", score: Math.min(100, (dashboard?.todoLeads.length ?? 0) * 10) },
    {
      metric: "Won Deals",
      score: Math.min(
        100,
        (dashboard?.phaseCounts.find((p) => p.phase === "CLOSED_WON")?._count.phase ?? 0) * 20
      )
    },
    {
      metric: "Follow-Ups",
      score: Math.min(
        100,
        (dashboard?.phaseCounts.find((p) => p.phase === "FOLLOW_UP")?._count.phase ?? 0) * 15
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">My Performance Hub</h2>
        <p className="text-xs text-muted mt-1">Monitor daily quota targets and follow-up activities.</p>
      </div>

      {/* My Conversion Stats */}
      {myStats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard label="My Conversions" value={myStats.conversions} tone="success" />
          <KPICard label="My Losses" value={myStats.losses} tone="danger" />
          <KPICard label="Conversion Rate" value={`${myStats.conversionRate}%`} tone={myStats.conversionRate >= 50 ? "success" : "warning"} />
          <KPICard label="Leads Claimed" value={myStats.claimedLeads} tone="accent" />
        </div>
      )}

      {/* Quota Progress Rings */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card 
          className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-6 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth flex flex-col sm:flex-row items-center justify-between gap-6"
          style={{ "--card-glow": "var(--accent)" } as React.CSSProperties}
        >
          {/* Decorative Glow Shape */}
          <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-accent/3 opacity-0 group-hover:opacity-100 blur-xl pointer-events-none group-hover:scale-170 transition-all duration-500 ease-out-smooth" />
          
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-sm font-bold text-foreground">Daily Calls Quota</h4>
            <p className="text-xs text-muted">Log call notes on contacts to complete today&apos;s goal.</p>
            <p className="text-2xl font-black text-foreground mt-4 leading-none font-mono">
              {callsCompleted} <span className="text-xs font-semibold text-muted font-sans">/ {callsTarget} logged</span>
            </p>
          </div>
          <div className="shrink-0">
            <CircularProgress value={callsCompleted} target={callsTarget} size={110} />
          </div>
        </Card>

        <Card 
          className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-6 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth flex flex-col sm:flex-row items-center justify-between gap-6"
          style={{ "--card-glow": "var(--warning)" } as React.CSSProperties}
        >
          {/* Decorative Glow Shape */}
          <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-warning/3 opacity-0 group-hover:opacity-100 blur-xl pointer-events-none group-hover:scale-170 transition-all duration-500 ease-out-smooth" />
          
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-sm font-bold text-foreground">Daily Leads Target</h4>
            <p className="text-xs text-muted">Work through and process contacts in the pipeline.</p>
            <p className="text-2xl font-black text-foreground mt-4 leading-none font-mono">
              {leadsProcessed} <span className="text-xs font-semibold text-muted font-sans">/ {leadsTarget} processed</span>
            </p>
          </div>
          <div className="shrink-0">
            <CircularProgress value={leadsProcessed} target={leadsTarget} size={110} />
          </div>
        </Card>
      </div>

      {/* Charts section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Performance Radar */}
        <Card 
          className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth lg:col-span-2"
          style={{ "--card-glow": "var(--accent)" } as React.CSSProperties}
        >
          {/* Decorative Glow Shape */}
          <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-accent/3 opacity-0 group-hover:opacity-100 blur-xl pointer-events-none group-hover:scale-170 transition-all duration-500 ease-out-smooth" />
          
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Metrics radar</h3>
          <p className="text-[11px] text-muted mt-1 mb-4">Operational balance across different categories.</p>
          <div className="h-64 w-full flex items-center justify-center">
            <RadarChart data={radarData} dataKey="score" angleKey="metric" />
          </div>
        </Card>

        {/* Pipeline stage breakdown */}
        <Card 
          className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth"
          style={{ "--card-glow": "#3b82f6" } as React.CSSProperties}
        >
          {/* Decorative Glow Shape */}
          <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-blue-500/3 opacity-0 group-hover:opacity-100 blur-xl pointer-events-none group-hover:scale-170 transition-all duration-500 ease-out-smooth" />
          
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Pipeline Stage Breakdown</h3>
          <p className="text-[11px] text-muted mt-1 mb-4">Ownership mix of leads assigned to you.</p>
          <div className="h-64 w-full flex flex-col justify-between">
            {phaseData.length > 0 ? (
              <>
                <div className="h-44 w-full">
                  <DonutChart data={phaseData} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4 text-[10px]">
                  {phaseData.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5 border border-separator rounded-lg px-2 py-1 bg-default/10">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                      <span className="truncate text-muted">{item.name}</span>
                      <span className="font-extrabold text-foreground ml-auto">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted">
                No active leads assigned
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Team Leaderboard */}
      <Card 
        className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth"
        style={{ "--card-glow": "var(--success)" } as React.CSSProperties}
      >
        {/* Decorative Glow Shape */}
        <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-success/3 opacity-0 group-hover:opacity-100 blur-xl pointer-events-none group-hover:scale-170 transition-all duration-500 ease-out-smooth" />
        
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Team Leaderboard</h3>
        <p className="text-[11px] text-muted mt-1 mb-4">See how you rank against other agents by conversions and activity.</p>
        <LeaderboardTable data={leaderboard} highlightUserId={myStats?.userId} />
      </Card>
    </div>
  );
}
export default SalesOverview;
