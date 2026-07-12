import { useAdminSummary } from "../hooks/use-admin-summary";
import { useAdminLeads } from "../hooks/use-admin-leads";
import { useAdminActivity } from "../hooks/use-admin-activity";
import { useLeaderboard } from "../hooks/use-leaderboard";
import { KPICard } from "../../../components/ui/kpi-card";
import { BarChart } from "../../../components/charts/bar-chart";
import { DonutChart } from "../../../components/charts/donut-chart";
import { LoadingSkeleton } from "../../../components/ui/loading-skeleton";
import { LeaderboardTable } from "../../../components/ui/leaderboard-table";
import { Card } from "../../../components/ui/card";
import { phaseLabels } from "../../../lib/utils/format";
import type { LeadPhase } from "../../../types";

const phaseColors: Record<LeadPhase, string> = {
  NEW: "var(--accent)",
  CONTACTED: "#3b82f6",
  FOLLOW_UP: "var(--warning)",
  CLOSED_WON: "var(--success)",
  CLOSED_LOST: "var(--danger)"
};

export function AdminOverview() {
  const { summary, isLoading: summaryLoading } = useAdminSummary();
  const { leads, salesUsers, isLoading: leadsLoading } = useAdminLeads();
  const { activities, isLoading: activityLoading } = useAdminActivity();
  const { leaderboard, isLoading: leaderboardLoading } = useLeaderboard();

  const isLoading = summaryLoading || leadsLoading || activityLoading || leaderboardLoading;

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

  // Prepare Pipeline Phase Data
  const phaseData = (Object.keys(phaseLabels) as LeadPhase[]).map((phase) => ({
    name: phaseLabels[phase],
    value: leads.filter((lead) => lead.phase === phase).length,
    fill: phaseColors[phase]
  }));

  // Prepare Agent Workload Data
  const agentData = salesUsers
    .map((user) => ({
      name: user.name,
      assigned: leads.filter((lead) => lead.claimedBy?.id === user.id).length,
      created: leads.filter((lead) => lead.createdBy?.id === user.id).length
    }))
    .sort((a, b) => b.assigned + b.created - (a.assigned + a.created))
    .slice(0, 5);

  // Prepare Activity Mix Data
  const activityTypes = [
    { type: "CALL_NOTE", label: "Calls", fill: "var(--accent)" },
    { type: "PHASE_CHANGED", label: "Stage Updates", fill: "#3b82f6" },
    { type: "LEAD_CREATED", label: "New Leads", fill: "var(--success)" },
    { type: "FOLLOW_UP_SET", label: "Follow-Ups", fill: "var(--warning)" }
  ];

  const activityData = activityTypes.map((t) => ({
    name: t.label,
    value: activities.filter((act) => act.type === t.type).length,
    fill: t.fill
  })).filter(item => item.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Welcome back, Admin</h2>
        <p className="text-xs text-muted mt-1">Here is a quick operational snapshot of ETCRM pipeline today.</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Total Leads" value={summary?.leads ?? 0} tone="accent" />
        <KPICard label="Sales Agents" value={summary?.salesUsers ?? 0} tone="default" />
        <KPICard label="Closed Won" value={summary?.won ?? 0} tone="success" />
        <KPICard label="Overall Win Rate" value={`${winRate}%`} tone="success" />
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pipeline Shape (Bar Chart) */}
        <Card 
          className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth lg:col-span-2"
          style={{ "--card-glow": "var(--accent)" } as React.CSSProperties}
        >
          {/* Decorative Glow Shape */}
          <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-accent/3 opacity-0 group-hover:opacity-100 blur-xl pointer-events-none group-hover:scale-170 transition-all duration-500 ease-out-smooth" />
          
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Pipeline Shape</h3>
          <p className="text-[11px] text-muted mt-1 mb-4">Total lead count grouped by pipeline phase.</p>
          <div className="h-64 w-full">
            {leads.length > 0 ? (
              <BarChart data={phaseData} xKey="name" yKeys={["value"]} />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted">No data available</div>
            )}
          </div>
        </Card>

        {/* Activity Mix (Donut Chart) */}
        <Card 
          className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth"
          style={{ "--card-glow": "#3b82f6" } as React.CSSProperties}
        >
          {/* Decorative Glow Shape */}
          <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-blue-500/3 opacity-0 group-hover:opacity-100 blur-xl pointer-events-none group-hover:scale-170 transition-all duration-500 ease-out-smooth" />
          
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Activity Distribution</h3>
          <p className="text-[11px] text-muted mt-1 mb-4">Types of actions logged in the timeline.</p>
          <div className="h-64 w-full flex flex-col justify-between">
            {activityData.length > 0 ? (
              <>
                <div className="h-44 w-full">
                  <DonutChart data={activityData} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4 text-[10px]">
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
              <div className="flex h-full items-center justify-center text-xs text-muted">No activities logged yet</div>
            )}
          </div>
        </Card>

        {/* Agent Load (Horizontal Bar Chart) */}
        <Card 
          className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth lg:col-span-3"
          style={{ "--card-glow": "var(--warning)" } as React.CSSProperties}
        >
          {/* Decorative Glow Shape */}
          <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-warning/3 opacity-0 group-hover:opacity-100 blur-xl pointer-events-none group-hover:scale-170 transition-all duration-500 ease-out-smooth" />
          
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Sales Representative Workload</h3>
          <p className="text-[11px] text-muted mt-1 mb-4">Lead ownership (Assigned vs Created) across active agents.</p>
          <div className="h-64 w-full">
            {agentData.length > 0 ? (
              <BarChart
                data={agentData}
                xKey="name"
                yKeys={["assigned", "created"]}
                colors={["var(--accent)", "var(--warning)"]}
                layout="vertical"
                stacked
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted">No agents registered</div>
            )}
          </div>
        </Card>
      </div>

      {/* Sales Leaderboard */}
      <Card 
        className="premium-card group relative overflow-hidden bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 ease-out-smooth"
        style={{ "--card-glow": "var(--success)" } as React.CSSProperties}
      >
        {/* Decorative Glow Shape */}
        <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-success/3 opacity-0 group-hover:opacity-100 blur-xl pointer-events-none group-hover:scale-170 transition-all duration-500 ease-out-smooth" />
        
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Sales Leaderboard</h3>
        <p className="text-[11px] text-muted mt-1 mb-4">Rankings by conversion count and contact activity.</p>
        <LeaderboardTable data={leaderboard} />
      </Card>

    </div>
  );
}
export default AdminOverview;
