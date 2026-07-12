import { Activity, CheckCircle2, PhoneCall, Target } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Radar, RadarChart, PolarAngleAxis, PolarGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LeadPhase, SalesDashboardData } from "../../../types";
import { phaseLabels } from "../../../utils/format";

const phaseColors: Record<LeadPhase, string> = {
  NEW: "#0f5f4f",
  CONTACTED: "#2563eb",
  FOLLOW_UP: "#c99428",
  CLOSED_WON: "#16a34a",
  CLOSED_LOST: "#e35f4f"
};

function percent(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}

function EmptyChart({ label }: { label: string }) {
  return <div className="flex h-full min-h-56 items-center justify-center rounded border border-dashed border-line text-sm text-neutral-500">{label}</div>;
}

export function SalesPerformancePanel({ dashboard }: { dashboard: SalesDashboardData | null }) {
  const callsCompleted = dashboard?.progress.callsCompleted ?? 0;
  const callsTarget = dashboard?.quota.callsTarget ?? 0;
  const leadsProcessed = dashboard?.progress.leadsProcessed ?? 0;
  const leadsTarget = dashboard?.quota.leadsTarget ?? 0;
  const callPercent = percent(callsCompleted, callsTarget);
  const leadPercent = percent(leadsProcessed, leadsTarget);

  const quotaData = [
    { name: "Calls", completed: callsCompleted, remaining: Math.max(callsTarget - callsCompleted, 0), target: callsTarget },
    { name: "Leads", completed: leadsProcessed, remaining: Math.max(leadsTarget - leadsProcessed, 0), target: leadsTarget }
  ];

  const phaseData = (Object.keys(phaseLabels) as LeadPhase[]).map((phase) => {
    const count = dashboard?.phaseCounts.find((item) => item.phase === phase)?._count.phase ?? 0;
    return { phase, name: phaseLabels[phase], value: count };
  });

  const radarData = [
    { metric: "Calls", score: callPercent },
    { metric: "Leads", score: leadPercent },
    { metric: "Queue", score: Math.min(100, (dashboard?.todoLeads.length ?? 0) * 12) },
    { metric: "Won", score: Math.min(100, (phaseData.find((item) => item.phase === "CLOSED_WON")?.value ?? 0) * 20) },
    { metric: "Follow-up", score: Math.min(100, (phaseData.find((item) => item.phase === "FOLLOW_UP")?.value ?? 0) * 16) }
  ];

  const activePipeline = phaseData.some((item) => item.value > 0);

  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-line bg-white shadow-soft">
      <div className="grid lg:grid-cols-[260px_1fr_280px]">
        <aside className="bg-forest p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-normal text-white/70">Today&apos;s pace</p>
          <p className="mt-3 text-5xl font-bold">{callPercent}%</p>
          <p className="mt-1 text-sm text-white/75">Call quota completion</p>
          <div className="mt-6 grid gap-3">
            <div className="rounded border border-white/15 bg-white/10 p-3">
              <div className="flex items-center gap-2 text-sm text-white/75">
                <PhoneCall size={16} />
                Calls made
              </div>
              <p className="mt-1 text-2xl font-bold">
                {callsCompleted}
                <span className="text-base font-semibold text-white/60"> / {callsTarget}</span>
              </p>
            </div>
            <div className="rounded border border-white/15 bg-white/10 p-3">
              <div className="flex items-center gap-2 text-sm text-white/75">
                <CheckCircle2 size={16} />
                Leads processed
              </div>
              <p className="mt-1 text-2xl font-bold">
                {leadsProcessed}
                <span className="text-base font-semibold text-white/60"> / {leadsTarget}</span>
              </p>
            </div>
            <div className="rounded border border-white/15 bg-white/10 p-3">
              <div className="flex items-center gap-2 text-sm text-white/75">
                <Target size={16} />
                Queue now
              </div>
              <p className="mt-1 text-2xl font-bold">{dashboard?.todoLeads.length ?? 0}</p>
            </div>
          </div>
        </aside>

        <div className="border-y border-line p-5 lg:border-x lg:border-y-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-ink">Performance stream</h2>
              <p className="mt-1 text-sm text-neutral-500">Calls, processed leads, and current pipeline health in one view.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded border border-line px-3 py-2 text-sm font-semibold text-forest">
              <Activity size={17} />
              {leadPercent}% lead target
            </div>
          </div>

          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quotaData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#e8efec" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "rgba(15,95,79,0.06)" }} />
                <Bar dataKey="completed" name="Completed" stackId="quota" fill="#0f5f4f" radius={[6, 6, 0, 0]} />
                <Bar dataKey="remaining" name="Remaining" stackId="quota" fill="#dfe8e4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {quotaData.map((item) => (
              <div key={item.name} className="rounded border border-line p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{item.name}</span>
                  <span className="text-neutral-500">{item.completed} of {item.target}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded bg-neutral-100">
                  <div className="h-full rounded bg-forest" style={{ width: `${percent(item.completed, item.target)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="p-5">
          <h3 className="font-bold text-ink">Pipeline radar</h3>
          <p className="mt-1 text-sm text-neutral-500">Quick balance check across today&apos;s work.</p>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius={70}>
                <PolarGrid stroke="#dfe8e4" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                <Radar dataKey="score" stroke="#0f5f4f" fill="#0f5f4f" fillOpacity={0.18} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 h-48">
            {activePipeline ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={phaseData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={3}>
                    {phaseData.map((entry) => (
                      <Cell key={entry.phase} fill={phaseColors[entry.phase]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No assigned pipeline yet." />
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
