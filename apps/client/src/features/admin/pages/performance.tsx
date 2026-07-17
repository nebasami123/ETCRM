import { useNavigate } from "react-router-dom";
import { Calendar, Award, Phone, TrendingUp, Megaphone, Users } from "lucide-react";
import { useAdminPerformance } from "../hooks/use-admin-performance";
import { KPICard } from "../../../components/ui/kpi-card";
import { BarChart } from "../../../components/charts/bar-chart";
import { LeaderboardTable } from "../../../components/ui/leaderboard-table";
import { Card } from "../../../components/ui/card";
import { LoadingSkeleton } from "../../../components/ui/loading-skeleton";
import { CustomSelect } from "../../../components/ui/custom-select";

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-success/15 text-success",
  PAUSED: "bg-warning/15 text-warning",
  CLOSED: "bg-danger/15 text-danger",
  DRAFT: "bg-default text-muted"
};

export function AdminPerformance() {
  const navigate = useNavigate();
  const {
    from,
    to,
    setFrom,
    setTo,
    setPresetRange,
    campaignId,
    setCampaignId,
    leaderboard,
    metrics,
    campaignAnalytics,
    selectedCampaign,
    isLoading,
    isCampaignLoading
  } = useAdminPerformance();

  const campaignOptions = [
    { value: "", label: "Full analytics" },
    ...campaignAnalytics.map((c) => ({
      value: c.id,
      label: c.name
    }))
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Performance</h2>
          <p className="text-xs text-muted mt-1">Team results and campaign progress.</p>
        </div>
        <LoadingSkeleton type="card" count={4} />
        <LoadingSkeleton type="table" count={5} />
      </div>
    );
  }

  const isCampaignView = Boolean(campaignId);
  const stats = selectedCampaign?.stats;
  const byAgent = stats?.byAgent ?? [];
  const working = (stats?.contacted ?? 0) + (stats?.followUp ?? 0);
  const decided = (stats?.won ?? 0) + (stats?.lost ?? 0);
  const winRate = decided > 0 ? Math.round(((stats?.won ?? 0) / decided) * 100) : 0;
  const topCloser = [...byAgent].sort((a, b) => b.won - a.won)[0];
  const topVolume = [...byAgent].sort((a, b) => b.total - a.total)[0];

  const totalConversions = metrics.reduce((acc, m) => acc + m.conversionsCredited, 0);
  const totalCalls = metrics.reduce((acc, m) => acc + m.callNotes, 0);
  const topAgent = [...metrics].sort((a, b) => b.conversionsCredited - a.conversionsCredited)[0];
  const topCaller = [...metrics].sort((a, b) => b.callNotes - a.callNotes)[0];

  const conversionsChartData = isCampaignView
    ? byAgent.map((a) => ({ name: a.name, Won: a.won }))
    : metrics.map((m) => ({ name: m.agent, Won: m.conversionsCredited }));

  const callsChartData = isCampaignView
    ? byAgent.map((a) => ({
        name: a.name,
        Working: a.contacted + a.followUp,
        Total: a.total
      }))
    : metrics.map((m) => ({
        name: m.agent,
        Calls: m.callNotes,
        Target: m.totalCallTarget
      }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Performance</h2>
          <p className="text-xs text-muted mt-1">
            {isCampaignView
              ? "Campaign-level results and agent outcomes."
              : "See who is closing deals, logging calls, and how campaigns are progressing."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-separator bg-surface p-2">
          <CustomSelect
            value={campaignId}
            onChange={setCampaignId}
            options={campaignOptions}
            size="sm"
            ariaLabel="Filter by campaign"
            className="min-w-[160px]"
            triggerClassName="border-field-border bg-field-background text-field-foreground focus:border-accent"
          />
          {!isCampaignView ? (
            <>
              <Calendar className="ml-1 h-4 w-4 text-muted" />
              {[
                [0, "Today"],
                [7, "7 days"],
                [30, "30 days"]
              ].map(([days, label]) => (
                <button
                  key={String(days)}
                  onClick={() => setPresetRange(Number(days))}
                  className="btn-interactive rounded-lg px-2.5 py-1 text-[10px] font-bold text-muted hover:bg-default hover:text-foreground"
                >
                  {label}
                </button>
              ))}
              <div className="flex items-center gap-1 border-l border-separator pl-2">
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded-md border border-field-border bg-field-background px-1.5 py-0.5 text-[10px]"
                />
                <span className="text-[10px] text-muted">to</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded-md border border-field-border bg-field-background px-1.5 py-0.5 text-[10px]"
                />
              </div>
            </>
          ) : null}
        </div>
      </div>

      {isCampaignView && isCampaignLoading ? (
        <>
          <LoadingSkeleton type="card" count={4} />
          <LoadingSkeleton type="table" count={5} />
        </>
      ) : isCampaignView && selectedCampaign ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">{selectedCampaign.name}</h3>
            {selectedCampaign.label ? (
              <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                {selectedCampaign.label}
              </span>
            ) : null}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_TONE[selectedCampaign.status] || ""}`}
            >
              {selectedCampaign.status}
            </span>
            <button
              type="button"
              onClick={() => navigate(`/admin/campaigns/${selectedCampaign.id}`)}
              className="btn-interactive ml-auto text-[11px] font-bold text-accent hover:underline"
            >
              Open campaign →
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <KPICard label="Total leads" value={stats?.total ?? 0} tone="accent" />
            <KPICard label="Still new" value={stats?.newCount ?? 0} />
            <KPICard label="In progress" value={working} tone="warning" />
            <KPICard label="Won" value={stats?.won ?? 0} tone="success" />
            <KPICard label="Lost" value={stats?.lost ?? 0} tone="danger" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard label="Progress" value={`${stats?.progressPct ?? 0}%`} tone="accent" />
            <KPICard label="Win rate" value={`${winRate}%`} tone="success" />
            <KPICard
              label="Top closer"
              value={topCloser && topCloser.won > 0 ? topCloser.name : "—"}
              tone="warning"
            />
            <KPICard label="Most assigned" value={topVolume && topVolume.total > 0 ? topVolume.name : "—"} />
          </div>

          {stats && stats.total > 0 ? (
            <Card className="rounded-xl border border-separator p-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-bold text-foreground">Campaign progress</span>
                <span className="text-muted">{stats.progressPct}% worked</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-default">
                <div className="h-full rounded-full bg-accent" style={{ width: `${stats.progressPct}%` }} />
              </div>
            </Card>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Card
              className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth"
              style={{ "--card-glow": "var(--success)" } as React.CSSProperties}
            >
              <div className="mb-1 flex items-center gap-2 text-success">
                <TrendingUp className="h-4 w-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Wins by agent</h3>
              </div>
              <p className="mb-4 text-[11px] text-muted">Closed-won leads in this campaign.</p>
              <div className="h-52 w-full">
                {conversionsChartData.some((d) => d.Won > 0) ? (
                  <BarChart data={conversionsChartData} xKey="name" yKeys={["Won"]} colors={["var(--success)"]} />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted">No wins yet</div>
                )}
              </div>
            </Card>

            <Card
              className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth"
              style={{ "--card-glow": "var(--accent)" } as React.CSSProperties}
            >
              <div className="mb-1 flex items-center gap-2 text-accent">
                <Phone className="h-4 w-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Pipeline by agent</h3>
              </div>
              <p className="mb-4 text-[11px] text-muted">Assigned leads vs still working.</p>
              <div className="h-52 w-full">
                {callsChartData.length > 0 ? (
                  <BarChart
                    data={callsChartData}
                    xKey="name"
                    yKeys={["Total", "Working"]}
                    colors={["oklch(from var(--accent) l c h / 25%)", "var(--accent)"]}
                    barGap="-100%"
                    overlapping
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted">No data yet</div>
                )}
              </div>
            </Card>
          </div>

          <Card
            className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth"
            style={{ "--card-glow": "var(--accent)" } as React.CSSProperties}
          >
            <div className="mb-3 flex items-center gap-2 text-accent">
              <Users className="h-4 w-4" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Agent outcomes</h3>
            </div>
            <p className="mb-4 text-[11px] text-muted">Phase breakdown for agents on this campaign.</p>
            <div className="overflow-x-auto" data-scrollbar="thin">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-separator bg-default/20 text-[10px] font-bold uppercase tracking-wider text-muted">
                    <th className="px-5 py-3">Agent</th>
                    <th className="px-4 py-3 text-center">Assigned</th>
                    <th className="px-4 py-3 text-center">New</th>
                    <th className="px-4 py-3 text-center">Working</th>
                    <th className="px-4 py-3 text-center">Won</th>
                    <th className="px-5 py-3 text-center">Lost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator">
                  {!byAgent.length ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-muted">
                        No agent assignments on this campaign.
                      </td>
                    </tr>
                  ) : (
                    byAgent.map((agent) => (
                      <tr key={agent.userId} className="hover:bg-default/20">
                        <td className="px-5 py-3 font-bold text-foreground">{agent.name}</td>
                        <td className="px-4 py-3 text-center font-semibold">{agent.total}</td>
                        <td className="px-4 py-3 text-center font-semibold">{agent.newCount}</td>
                        <td className="px-4 py-3 text-center font-semibold text-warning">
                          {agent.contacted + agent.followUp}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-success">{agent.won}</td>
                        <td className="px-5 py-3 text-center font-semibold text-danger">{agent.lost}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard label="Deals won" value={totalConversions} tone="success" />
            <KPICard label="Calls logged" value={totalCalls} tone="accent" />
            <KPICard
              label="Top closer"
              value={topAgent && topAgent.conversionsCredited > 0 ? topAgent.agent : "—"}
              tone="warning"
            />
            <KPICard
              label="Top caller"
              value={topCaller && topCaller.callNotes > 0 ? topCaller.agent : "—"}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card
              className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth"
              style={{ "--card-glow": "var(--success)" } as React.CSSProperties}
            >
              <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-success/3 opacity-0 group-hover:opacity-100 blur-xl pointer-events-none group-hover:scale-170 transition-all duration-500 ease-out-smooth" />
              <div className="mb-1 flex items-center gap-2 text-success">
                <TrendingUp className="h-4 w-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Deals won</h3>
              </div>
              <p className="mb-4 text-[11px] text-muted">Wins credited in the selected date range.</p>
              <div className="h-52 w-full">
                {conversionsChartData.length > 0 ? (
                  <BarChart data={conversionsChartData} xKey="name" yKeys={["Won"]} colors={["var(--success)"]} />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted">No data yet</div>
                )}
              </div>
            </Card>

            <Card
              className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth"
              style={{ "--card-glow": "var(--accent)" } as React.CSSProperties}
            >
              <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-accent/3 opacity-0 group-hover:opacity-100 blur-xl pointer-events-none group-hover:scale-170 transition-all duration-500 ease-out-smooth" />
              <div className="mb-1 flex items-center gap-2 text-accent">
                <Phone className="h-4 w-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Calls vs target</h3>
              </div>
              <p className="mb-4 text-[11px] text-muted">Calls logged compared with daily call targets in range.</p>
              <div className="h-52 w-full">
                {callsChartData.length > 0 ? (
                  <BarChart
                    data={callsChartData}
                    xKey="name"
                    yKeys={["Target", "Calls"]}
                    colors={["oklch(from var(--accent) l c h / 25%)", "var(--accent)"]}
                    barGap="-100%"
                    overlapping
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted">No data yet</div>
                )}
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card
              className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth"
              style={{ "--card-glow": "var(--success)" } as React.CSSProperties}
            >
              <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-success/3 opacity-0 group-hover:opacity-100 blur-xl pointer-events-none group-hover:scale-170 transition-all duration-500 ease-out-smooth" />
              <div className="mb-3 flex items-center gap-2 text-success">
                <Award className="h-4 w-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Leaderboard</h3>
              </div>
              <p className="mb-4 text-[11px] text-muted">All-time ranking by wins and activity.</p>
              <LeaderboardTable data={leaderboard} />
            </Card>

            <Card
              className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth"
              style={{ "--card-glow": "var(--accent)" } as React.CSSProperties}
            >
              <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-accent/3 opacity-0 group-hover:opacity-100 blur-xl pointer-events-none group-hover:scale-170 transition-all duration-500 ease-out-smooth" />
              <div className="mb-3 flex items-center gap-2 text-accent">
                <Users className="h-4 w-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Agent breakdown</h3>
              </div>
              <p className="mb-4 text-[11px] text-muted">Detailed numbers for the selected date range.</p>
              <div className="overflow-x-auto" data-scrollbar="thin">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-separator bg-default/20 text-[10px] font-bold uppercase tracking-wider text-muted">
                      <th className="px-5 py-3">Agent</th>
                      <th className="px-4 py-3 text-center">Claimed</th>
                      <th className="px-4 py-3 text-center">Created</th>
                      <th className="px-4 py-3 text-center">Won</th>
                      <th className="px-4 py-3 text-center">Calls / target</th>
                      <th className="px-5 py-3 text-center">Quota</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-separator">
                    {metrics.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-muted">
                          No activity in this date range.
                        </td>
                      </tr>
                    ) : (
                      metrics.map((member) => {
                        const quotaPct =
                          member.totalCallTarget > 0
                            ? Math.min(100, Math.round((member.callNotes / member.totalCallTarget) * 100))
                            : 0;
                        return (
                          <tr key={member.email} className="hover:bg-default/20">
                            <td className="px-5 py-3">
                              <p className="font-bold text-foreground">{member.agent}</p>
                              <p className="text-[10px] text-muted">{member.email}</p>
                            </td>
                            <td className="px-4 py-3 text-center font-semibold">{member.claimedLeads}</td>
                            <td className="px-4 py-3 text-center font-semibold">{member.createdLeads}</td>
                            <td className="px-4 py-3 text-center font-bold text-success">{member.conversionsCredited}</td>
                            <td className="px-4 py-3 text-center font-mono">
                              {member.callNotes} / {member.totalCallTarget}
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span
                                className={`text-xs font-bold ${
                                  quotaPct >= 100 ? "text-success" : quotaPct >= 50 ? "text-warning" : "text-muted"
                                }`}
                              >
                                {quotaPct}%
                              </span>
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

          <Card
            className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth"
            style={{ "--card-glow": "var(--accent)" } as React.CSSProperties}
          >
            <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-accent/3 opacity-0 group-hover:opacity-100 blur-xl pointer-events-none group-hover:scale-170 transition-all duration-500 ease-out-smooth" />
            <div className="border-b border-separator px-5 py-4">
              <div className="flex items-center gap-2 text-accent">
                <Megaphone className="h-4 w-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Campaign results</h3>
              </div>
              <p className="mt-1 text-[11px] text-muted">Progress and win rate for each launched campaign.</p>
            </div>
            {!campaignAnalytics.length ? (
              <p className="p-8 text-center text-xs text-muted">No launched campaigns yet.</p>
            ) : (
              <div className="overflow-x-auto" data-scrollbar="thin">
                <table className="w-full min-w-200 text-left text-xs">
                  <thead>
                    <tr className="border-b border-separator bg-default/20 text-[10px] font-bold uppercase tracking-wider text-muted">
                      <th className="px-5 py-3">Campaign</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-center">Length</th>
                      <th className="px-4 py-3 text-center">Leads</th>
                      <th className="px-4 py-3 text-center">Working</th>
                      <th className="px-4 py-3 text-center">Won</th>
                      <th className="px-4 py-3 text-center">Lost</th>
                      <th className="px-4 py-3 text-center">Progress</th>
                      <th className="px-5 py-3 text-center">Win rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-separator">
                    {campaignAnalytics.map((row) => (
                      <tr
                        key={row.id}
                        className="cursor-pointer hover:bg-default/20"
                        onClick={() => setCampaignId(row.id)}
                      >
                        <td className="px-5 py-3">
                          <p className="font-bold text-foreground">{row.name}</p>
                          {row.label ? <p className="text-[10px] text-accent font-semibold">{row.label}</p> : null}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_TONE[row.status] || ""}`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-muted">{row.durationDays}d</td>
                        <td className="px-4 py-3 text-center font-semibold text-foreground">{row.stats.total}</td>
                        <td className="px-4 py-3 text-center text-warning font-semibold">{row.stats.working}</td>
                        <td className="px-4 py-3 text-center text-success font-bold">{row.stats.won}</td>
                        <td className="px-4 py-3 text-center text-danger font-semibold">{row.stats.lost}</td>
                        <td className="px-4 py-3">
                          <div className="mx-auto flex w-24 items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-default">
                              <div
                                className="h-full rounded-full bg-accent"
                                style={{ width: `${row.stats.progressPct}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-muted">{row.stats.progressPct}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-center font-bold text-foreground">{row.stats.winRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

export default AdminPerformance;
