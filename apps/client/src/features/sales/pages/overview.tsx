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
import { Link } from "react-router-dom";
import { BellRing, CalendarClock, ChevronRight, AlertTriangle } from "lucide-react";
import { formatDateTime } from "../../../lib/utils/format";
import { useState } from "react";
import { LeadModal } from "./pipeline";

const phaseColors: Record<LeadPhase, string> = {
  NEW: "var(--accent)",
  CONTACTED: "#3b82f6",
  FOLLOW_UP: "var(--warning)",
  N_A: "var(--muted)",
  CLOSED_WON: "var(--success)",
  CLOSED_LOST: "var(--danger)"
};

export function SalesOverview() {
  const { dashboard, isLoading } = useSalesOverview();
  const { leaderboard, myStats, isLoading: leaderboardLoading } = useSalesLeaderboard();
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

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

      {(dashboard?.overdueCount ?? 0) > 0 && (
        <Card className="rounded-xl border border-danger/30 bg-danger/5 p-4 shadow-surface">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
              <div>
                <p className="text-xs font-bold text-danger">{dashboard?.overdueCount} overdue follow-up{dashboard?.overdueCount === 1 ? "" : "s"}</p>
                <p className="mt-0.5 text-[11px] text-muted">Past-due on leads you claim — open one to reschedule or log a call.</p>
              </div>
            </div>
            <Link to="/sales/leads" className="text-[11px] font-bold text-danger hover:underline">
              View my leads
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(dashboard?.overdueFollowUps ?? []).slice(0, 5).map((lead) => (
              <button
                key={lead.id}
                onClick={() => setOpenLeadId(lead.id)}
                className="btn-interactive rounded-lg border border-danger/20 bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:border-danger/40"
              >
                {lead.fullName}
                <span className="ml-1.5 text-[10px] font-normal text-muted">{formatDateTime(lead.nextFollowUpAt)}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <Card className="rounded-xl border border-separator bg-surface p-5 shadow-surface">
          <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">Today&apos;s focus</p><h3 className="mt-1 text-sm font-bold text-foreground">Next commitments</h3></div><Link to="/sales/planner" className="inline-flex items-center gap-1 text-[11px] font-bold text-accent hover:underline">Open planner <ChevronRight className="h-3.5 w-3.5" /></Link></div>
          <div className="mt-4 divide-y divide-separator">{dashboard?.reminders.length ? dashboard.reminders.map((reminder) => <div key={reminder.id} className="flex items-center gap-3 py-2.5"><span className="rounded-lg bg-accent/10 p-2 text-accent"><BellRing className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-foreground">{reminder.label}</p><p className="text-[10px] text-muted">{formatDateTime(reminder.dueAt)}</p></div></div>) : <p className="py-7 text-center text-xs text-muted">No personal reminders due today.</p>}</div>
        </Card>
        <Card className="rounded-xl border border-separator bg-linear-to-br from-success/8 to-surface p-5 shadow-surface"><CalendarClock className="h-5 w-5 text-success" /><p className="mt-5 text-2xl font-black text-foreground">{dashboard?.todoLeads.length ?? 0}</p><p className="mt-1 text-xs font-bold text-foreground">Lead actions due today</p><p className="mt-1 text-[11px] leading-relaxed text-muted">Appointments, follow-ups, and new leads are collected in your planner so nothing slips through.</p><Link to="/sales/planner" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-success hover:underline">Review schedule <ChevronRight className="h-3.5 w-3.5" /></Link></Card>
      </div>

      {openLeadId && <LeadModal leadId={openLeadId} onClose={() => setOpenLeadId(null)} />}

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
