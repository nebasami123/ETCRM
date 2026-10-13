import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Users, BriefcaseBusiness, Trophy, CircleCheckBig } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "../../../components/ui/card";
import { LeaderboardTable } from "../../../components/ui/leaderboard-table";
import { LoadingSkeleton } from "../../../components/ui/loading-skeleton";
import { salesAdminApi } from "../api";
import type { SalesAdminDashboardData } from "../../../types";

const numberFormat = new Intl.NumberFormat();

export function SalesAdminDashboard() {
  const [data, setData] = useState<SalesAdminDashboardData | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try { setData(await salesAdminApi.dashboard()); }
    catch { setError("Could not load the team overview."); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (!data) return error
    ? <div className="crm-card flex flex-wrap items-center justify-between gap-4 p-5 text-sm" role="alert"><span className="text-danger">{error}</span><button type="button" onClick={() => void load()} className="font-medium text-accent underline underline-offset-2">Try again</button></div>
    : <div className="space-y-6" aria-busy="true"><LoadingSkeleton type="card" count={4} /><LoadingSkeleton type="table" count={4} /></div>;
  const stats = [
    { label: "Sales reps", value: data.team.INTERNAL + data.team.EXTERNAL, hint: `${data.team.active} active · ${data.team.inactive} inactive`, icon: Users },
    { label: "Team-owned leads", value: data.leads.total, hint: `${data.leads.open} in progress`, icon: BriefcaseBusiness },
    { label: "Closed won", value: data.leads.won, hint: `${data.leads.lost} closed lost`, icon: CircleCheckBig },
    { label: "Team categories", value: `${data.team.INTERNAL} / ${data.team.EXTERNAL}`, hint: "Internal / External", icon: Trophy }
  ];
  const maxStageCount = Math.max(1, ...data.pipeline.map(({ count }) => count));

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-bold text-foreground">Sales team overview</h1><p className="mt-1 text-xs text-muted">Monitor assigned sales work and team performance.</p></div><Link to="team" className="btn-interactive inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-accent-foreground">Manage team <ArrowUpRight className="h-3.5 w-3.5" /></Link></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map(({ label, value, hint, icon: Icon }) => <Card key={label} className="rounded-xl border border-separator bg-surface p-4 shadow-surface"><div className="flex items-center justify-between text-muted"><span className="text-xs font-semibold">{label}</span><Icon className="h-4 w-4 text-accent" /></div><p className="mt-3 text-2xl font-bold text-foreground">{typeof value === "number" ? numberFormat.format(value) : value}</p><p className="mt-1 text-[11px] text-muted">{hint}</p></Card>)}</div>

    <Card className="overflow-hidden rounded-xl border border-separator bg-surface shadow-surface">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-separator p-4 sm:px-5">
        <div><h2 className="text-sm font-bold text-foreground">Leads by pipeline stage</h2><p className="mt-1 text-xs text-muted">{numberFormat.format(data.leads.total)} leads created or owned by your sales team. Select a stage to view its leads.</p></div>
        <span className="rounded-full border border-separator bg-default/30 px-2.5 py-1 text-[10px] font-semibold text-muted">{data.pipeline.length} stages</span>
      </div>
      <div className="space-y-1.5 p-3 sm:p-4">
        {data.pipeline.map(({ stage, count }, index) => {
          const share = data.leads.total ? Math.round((count / data.leads.total) * 100) : 0;
          const fillClass = stage === "Closed Won"
            ? "bg-success"
            : stage === "Closed Lost"
              ? "bg-danger"
              : "bg-accent";
          const labelClass = stage === "Closed Won"
            ? "text-success"
            : stage === "Closed Lost"
              ? "text-danger"
              : "text-foreground";
          return <Link
            key={stage}
            to={`/sales-admin/leads?stage=${encodeURIComponent(stage)}`}
            aria-label={`${stage}: ${numberFormat.format(count)} leads, ${share}% of team leads. Open filtered leads.`}
            className="group grid grid-cols-[minmax(0,1fr)_minmax(4rem,2.5fr)_3.25rem_3rem] items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-default/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:grid-cols-[minmax(10rem,1fr)_minmax(6rem,3fr)_4rem_3.5rem] sm:gap-4 sm:px-3"
          >
            <span className={`min-w-0 truncate text-xs font-semibold ${labelClass}`}><span className="mr-2 inline-block w-4 text-right text-[10px] font-medium text-muted">{String(index + 1).padStart(2, "0")}</span>{stage}</span>
            <span className="h-2 overflow-hidden rounded-full bg-default" role="progressbar" aria-valuenow={count} aria-valuemin={0} aria-valuemax={Math.max(data.leads.total, count)} aria-label={`${stage} lead count`}>
              <span className={`block h-full rounded-full transition-[width] duration-500 ${fillClass}`} style={{ width: `${count ? Math.max(2, (count / maxStageCount) * 100) : 0}%` }} />
            </span>
            <span className="text-right text-xs font-bold tabular-nums text-foreground">{numberFormat.format(count)}</span>
            <span className="text-right text-[10px] tabular-nums text-muted">{share}%</span>
          </Link>;
        })}
      </div>
      <div className="flex justify-between border-t border-separator px-5 py-2 text-[10px] uppercase tracking-wide text-muted"><span>Stage · all stages shown, including zero</span><span>Count · share</span></div>
    </Card>

    <Card className="overflow-hidden rounded-xl border border-separator bg-surface shadow-surface"><div className="border-b border-separator p-4"><h2 className="text-sm font-bold text-foreground">Sales performance</h2><p className="mt-1 text-xs text-muted">Ranked by activity and conversions.</p></div><div className="p-2"><LeaderboardTable data={data.leaderboard} /></div></Card>
  </div>;
}
