import { Calendar, Award, Phone, Target, Flame, TrendingUp } from "lucide-react";
import { useAdminPerformance } from "../hooks/use-admin-performance";
import { KPICard } from "../../../components/ui/kpi-card";
import { BarChart } from "../../../components/charts/bar-chart";
import { LeaderboardTable } from "../../../components/ui/leaderboard-table";
import { Card } from "../../../components/ui/card";
import { LoadingSkeleton } from "../../../components/ui/loading-skeleton";

export function AdminPerformance() {
  const {
    from,
    to,
    setFrom,
    setTo,
    setPresetRange,
    leaderboard,
    metrics,
    isLoading
  } = useAdminPerformance();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Sales Performance</h2>
          <p className="text-xs text-muted mt-1">Analyze agent activities, conversion rates, and quota achievement.</p>
        </div>
        <LoadingSkeleton type="card" count={4} />
        <LoadingSkeleton type="table" count={5} />
      </div>
    );
  }

  // Compute KPIs
  const totalConversions = metrics.reduce((acc, m) => acc + m.conversionsCredited, 0);
  const totalCalls = metrics.reduce((acc, m) => acc + m.callNotes, 0);

  const sortedByConversions = [...metrics].sort((a, b) => b.conversionsCredited - a.conversionsCredited);
  const topAgent = sortedByConversions[0];
  const topAgentName = topAgent && topAgent.conversionsCredited > 0 
    ? `${topAgent.agent} (${topAgent.conversionsCredited} Won)` 
    : "N/A";

  const sortedByCalls = [...metrics].sort((a, b) => b.callNotes - a.callNotes);
  const topCaller = sortedByCalls[0];
  const topCallerName = topCaller && topCaller.callNotes > 0 
    ? `${topCaller.agent} (${topCaller.callNotes} Calls)` 
    : "N/A";

  // Prepare chart datasets
  const conversionsChartData = metrics.map((m) => ({
    name: m.agent,
    Conversions: m.conversionsCredited
  }));

  const callsChartData = metrics.map((m) => ({
    name: m.agent,
    Completed: m.callNotes,
    Target: m.totalCallTarget
  }));

  return (
    <div className="space-y-6">
      {/* Header with Date Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Sales Performance</h2>
          <p className="text-xs text-muted mt-1">Analyze agent activities, conversion rates, and quota achievement.</p>
        </div>

        {/* Date Filter Panel */}
        <div className="flex flex-wrap items-center gap-2 bg-surface border border-separator rounded-xl p-2 shadow-sm w-fit">
          <div className="flex items-center gap-1.5 px-2 text-muted">
            <Calendar className="h-4.5 w-4.5 shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Filter Range:</span>
          </div>
          
          <button
            onClick={() => setPresetRange(0)}
            className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-border text-foreground hover:bg-default hover:text-foreground transition-all duration-160"
          >
            Today
          </button>
          <button
            onClick={() => setPresetRange(7)}
            className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-border text-foreground hover:bg-default hover:text-foreground transition-all duration-160"
          >
            7 Days
          </button>
          <button
            onClick={() => setPresetRange(30)}
            className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-border text-foreground hover:bg-default hover:text-foreground transition-all duration-160"
          >
            30 Days
          </button>

          <div className="flex items-center gap-1 border-l border-separator pl-2.5 ml-0.5">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-field-border bg-field-background px-1.5 py-0.5 text-[10px] text-field-foreground focus:border-accent focus:outline-none"
            />
            <span className="text-[10px] text-muted font-semibold">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-field-border bg-field-background px-1.5 py-0.5 text-[10px] text-field-foreground focus:border-accent focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Total Conversions" value={totalConversions} tone="success" />
        <KPICard label="Total Calls Logged" value={totalCalls} tone="accent" />
        <KPICard label="Top Converter" value={topAgentName} tone="warning" />
        <KPICard label="Top Caller" value={topCallerName} tone="default" />
      </div>

      {/* Leaderboard and Detailed Metrics Breakdown */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Global Sales Leaderboard */}
        <Card 
          className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth lg:col-span-1"
          style={{ "--card-glow": "var(--success)" } as React.CSSProperties}
        >
          <div className="flex items-center gap-2 mb-3 text-success">
            <Award className="h-4.5 w-4.5" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">All-Time Leaderboard</h3>
          </div>
          <p className="text-[11px] text-muted leading-relaxed mb-4">
            Leaderboard standings based on won leads, overall conversion efficiency, and contact activity.
          </p>
          <LeaderboardTable data={leaderboard} />
        </Card>

        {/* Visual Charts Comparison */}
        <div className="lg:col-span-2 space-y-6">
          {/* Conversions Comparison */}
          <Card 
            className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth"
            style={{ "--card-glow": "var(--accent)" } as React.CSSProperties}
          >
            <div className="flex items-center gap-2 mb-1 text-accent">
              <TrendingUp className="h-4.5 w-4.5" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Closed Won Conversions</h3>
            </div>
            <p className="text-[11px] text-muted mb-4">Compare closed won conversions credited to each agent in the selected range.</p>
            <div className="h-56 w-full">
              {conversionsChartData.length > 0 ? (
                <BarChart data={conversionsChartData} xKey="name" yKeys={["Conversions"]} colors={["var(--success)"]} />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted">No data available</div>
              )}
            </div>
          </Card>

          {/* Calls Logged vs Quotas */}
          <Card 
            className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth"
            style={{ "--card-glow": "var(--warning)" } as React.CSSProperties}
          >
            <div className="flex items-center gap-2 mb-1 text-warning">
              <Phone className="h-4.5 w-4.5" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Call Performance vs Quota Targets</h3>
            </div>
            <p className="text-[11px] text-muted mb-4">Logged phone calls vs the assigned calls quota target in the selected range.</p>
            <div className="h-56 w-full">
              {callsChartData.length > 0 ? (
                <BarChart
                  data={callsChartData}
                  xKey="name"
                  yKeys={["Completed", "Target"]}
                  colors={["var(--accent)", "var(--border)"]}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted">No data available</div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Detailed Metrics Table */}
      <Card 
        className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth"
        style={{ "--card-glow": "var(--accent)" } as React.CSSProperties}
      >
        <div className="flex items-center gap-2 mb-1 text-accent">
          <Flame className="h-4.5 w-4.5" />
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Detailed Agent Metrics</h3>
        </div>
        <p className="text-[11px] text-muted mb-4">Complete breakdown of productivity, quotas, and conversion counts.</p>

        <div className="overflow-x-auto" data-scrollbar="thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-separator bg-default/20 text-muted font-bold uppercase tracking-wider text-[10px]">
                <th className="px-5 py-3">Sales Agent</th>
                <th className="px-5 py-3 text-center">Leads Claimed</th>
                <th className="px-5 py-3 text-center">Leads Created</th>
                <th className="px-5 py-3 text-center">Conversions</th>
                <th className="px-5 py-3 text-center">Calls / Target</th>
                <th className="px-5 py-3 text-center">Quota Progress</th>
                <th className="px-5 py-3 text-center">Logged Events</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-separator text-foreground font-medium">
              {metrics.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-muted">
                    No performance data logged within this date range.
                  </td>
                </tr>
              ) : (
                metrics.map((member) => {
                  const quotaPct = member.totalCallTarget > 0 
                    ? Math.min(100, Math.round((member.callNotes / member.totalCallTarget) * 100))
                    : 0;
                  
                  return (
                    <tr key={member.email} className="hover:bg-default/20 transition-colors duration-160">
                      <td className="px-5 py-3.5 flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent font-semibold uppercase">
                          {member.agent.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{member.agent}</p>
                          <p className="text-[10px] text-muted">{member.email}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center text-foreground font-semibold">{member.claimedLeads}</td>
                      <td className="px-5 py-3.5 text-center text-foreground font-semibold">{member.createdLeads}</td>
                      <td className="px-5 py-3.5 text-center text-success font-extrabold">{member.conversionsCredited}</td>
                      <td className="px-5 py-3.5 text-center text-foreground font-semibold font-mono">
                        {member.callNotes} <span className="text-muted">/</span> {member.totalCallTarget}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="inline-flex items-center gap-2">
                          <span className={`text-xs font-bold font-mono ${quotaPct >= 100 ? "text-success" : quotaPct >= 50 ? "text-warning" : "text-muted"}`}>
                            {quotaPct}%
                          </span>
                          <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden shrink-0">
                            <div 
                              className={`h-full rounded-full ${quotaPct >= 100 ? "bg-success" : quotaPct >= 50 ? "bg-warning" : "bg-muted"}`} 
                              style={{ width: `${quotaPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center text-foreground font-mono text-[11px]">
                        {member.activities}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default AdminPerformance;
