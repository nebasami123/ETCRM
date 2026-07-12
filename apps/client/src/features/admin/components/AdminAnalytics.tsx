import { BarChart3, CalendarClock, PhoneCall, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Activity, AdminSummary, Lead, LeadPhase, UserSummary } from "../../../types";
import { phaseLabels } from "../../../utils/format";

interface AdminAnalyticsProps {
  summary: AdminSummary | null;
  leads: Lead[];
  activities: Activity[];
  salesUsers: UserSummary[];
}

const phaseColors: Record<LeadPhase, string> = {
  NEW: "#0f5f4f",
  CONTACTED: "#2563eb",
  FOLLOW_UP: "#c99428",
  CLOSED_WON: "#16a34a",
  CLOSED_LOST: "#e35f4f"
};

const activityLabels: Record<Activity["type"], string> = {
  CALL_NOTE: "Calls",
  PHASE_CHANGED: "Phase changes",
  APPOINTMENT_SET: "Appointments",
  LEAD_CREATED: "New leads",
  LEAD_IMPORTED: "Imports",
  LEAD_CLAIMED: "Claims",
  FOLLOW_UP_SET: "Follow-ups",
  CLAIM_TRANSFER_REQUESTED: "Transfer requests",
  CLAIM_TRANSFER_APPROVED: "Transfer approvals",
  CLAIM_TRANSFER_REJECTED: "Transfer rejections"
};

function EmptyChart({ label }: { label: string }) {
  return <div className="flex h-full min-h-56 items-center justify-center rounded border border-dashed border-line text-sm text-neutral-500">{label}</div>;
}

export function AdminAnalytics({ summary, leads, activities, salesUsers }: AdminAnalyticsProps) {
  const phaseData = (Object.keys(phaseLabels) as LeadPhase[]).map((phase) => ({
    phase,
    name: phaseLabels[phase],
    value: leads.filter((lead) => lead.phase === phase).length
  }));

  const agentData = salesUsers
    .map((user) => ({
      name: user.name,
      assigned: leads.filter((lead) => lead.claimedBy?.id === user.id).length,
      created: leads.filter((lead) => lead.createdBy?.id === user.id).length
    }))
    .sort((a, b) => b.assigned + b.created - (a.assigned + a.created))
    .slice(0, 6);

  const activityData = (Object.keys(activityLabels) as Activity["type"][]).map((type) => ({
    name: activityLabels[type],
    value: activities.filter((activity) => activity.type === type).length
  }));

  const callsLogged = activities.filter((activity) => activity.type === "CALL_NOTE").length;
  const appointments = leads.filter((lead) => Boolean(lead.appointmentDate)).length;
  const assigned = leads.filter((lead) => Boolean(lead.claimedBy?.id)).length;
  const conversionBase = (summary?.won || 0) + (summary?.lost || 0);
  const winRate = conversionBase ? Math.round(((summary?.won || 0) / conversionBase) * 100) : 0;

  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-line bg-white shadow-soft">
      <div className="grid gap-0 lg:grid-cols-[260px_1fr_280px]">
        <aside className="bg-forest p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-normal text-white/70">Operations pulse</p>
          <p className="mt-3 text-5xl font-bold">{summary?.leads ?? "-"}</p>
          <p className="mt-1 text-sm text-white/75">Total leads in CRM</p>
          <div className="mt-6 grid gap-3">
            <div className="rounded border border-white/15 bg-white/10 p-3">
              <div className="flex items-center gap-2 text-sm text-white/75">
                <PhoneCall size={16} />
                Recent calls logged
              </div>
              <p className="mt-1 text-2xl font-bold">{callsLogged}</p>
            </div>
            <div className="rounded border border-white/15 bg-white/10 p-3">
              <div className="flex items-center gap-2 text-sm text-white/75">
                <CalendarClock size={16} />
                Appointments
              </div>
              <p className="mt-1 text-2xl font-bold">{appointments}</p>
            </div>
            <div className="rounded border border-white/15 bg-white/10 p-3">
              <div className="flex items-center gap-2 text-sm text-white/75">
                <Users size={16} />
                Assigned leads
              </div>
              <p className="mt-1 text-2xl font-bold">{assigned}</p>
            </div>
          </div>
        </aside>

        <div className="border-y border-line p-5 lg:border-x lg:border-y-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-ink">Lead performance overview</h2>
              <p className="mt-1 text-sm text-neutral-500">Pipeline shape, agent load, and recent work from the current dashboard data.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded border border-line px-3 py-2 text-sm font-semibold text-forest">
              <BarChart3 size={17} />
              {winRate}% win rate
            </div>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
            <div className="h-72">
              {phaseData.some((item) => item.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={phaseData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid stroke="#e8efec" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "rgba(15,95,79,0.06)" }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {phaseData.map((entry) => (
                        <Cell key={entry.phase} fill={phaseColors[entry.phase]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="No phase data yet." />
              )}
            </div>

            <div className="h-72">
              {agentData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agentData} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                    <CartesianGrid stroke="#e8efec" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" width={84} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "rgba(15,95,79,0.06)" }} />
                    <Bar dataKey="assigned" name="Assigned" stackId="agent" fill="#0f5f4f" radius={[0, 6, 6, 0]} />
                    <Bar dataKey="created" name="Created" stackId="agent" fill="#c99428" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="No agent load data yet." />
              )}
            </div>
          </div>
        </div>

        <aside className="p-5">
          <h3 className="font-bold text-ink">Recent activity mix</h3>
          <p className="mt-1 text-sm text-neutral-500">What the team has been doing lately.</p>
          <div className="mt-4 h-52">
            {activityData.some((item) => item.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={activityData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={3}>
                    {activityData.map((entry, index) => (
                      <Cell key={entry.name} fill={["#0f5f4f", "#2563eb", "#c99428", "#16a34a", "#e35f4f"][index]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No recent activity yet." />
            )}
          </div>
          <div className="mt-3 grid gap-2">
            {activityData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between rounded border border-line px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ["#0f5f4f", "#2563eb", "#c99428", "#16a34a", "#e35f4f"][index] }} />
                  {item.name}
                </span>
                <span className="font-bold">{item.value}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
