import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, PhoneCall, Save } from "lucide-react";
import { api } from "../../api/client";
import { Badge } from "../../components/Badge";
import { StatCard } from "../../components/StatCard";
import { AppLayout } from "../../layouts/AppLayout";
import { formatDate, formatDateTime, phaseOptions } from "../../utils/format";

function ProgressBar({ value, max }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{value} completed</span>
        <span>{max} target</span>
      </div>
      <div className="h-3 overflow-hidden rounded bg-neutral-100">
        <div className="h-full rounded bg-forest transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function SalesDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [leads, setLeads] = useState([]);
  const [activeLeadId, setActiveLeadId] = useState(null);
  const [activeLead, setActiveLead] = useState(null);
  const [phase, setPhase] = useState("NEW");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");

  const activeList = dashboard?.todoLeads?.length ? dashboard.todoLeads : leads;
  const phaseChart = useMemo(() => dashboard?.phaseCounts || [], [dashboard]);

  async function loadDashboard() {
    const [dashRes, leadsRes] = await Promise.all([api.get("/sales/dashboard"), api.get("/sales/leads")]);
    setDashboard(dashRes.data);
    setLeads(leadsRes.data.leads);
    if (!activeLeadId && (dashRes.data.todoLeads[0] || leadsRes.data.leads[0])) {
      setActiveLeadId((dashRes.data.todoLeads[0] || leadsRes.data.leads[0]).id);
    }
  }

  async function loadLead(id) {
    if (!id) return;
    const { data } = await api.get(`/sales/leads/${id}`);
    setActiveLead(data.lead);
    setPhase(data.lead.phase);
  }

  useEffect(() => {
    loadDashboard().catch((error) => setNotice(error.response?.data?.message || "Could not load dashboard"));
  }, []);

  useEffect(() => {
    loadLead(activeLeadId).catch((error) => setNotice(error.response?.data?.message || "Could not load lead"));
  }, [activeLeadId]);

  async function savePhase() {
    if (!activeLead) return;
    const { data } = await api.patch(`/sales/leads/${activeLead.id}/phase`, { phase });
    setActiveLead(data.lead);
    setNotice("Phase updated.");
    await loadDashboard();
  }

  async function addNote(event) {
    event.preventDefault();
    if (!activeLead || note.trim().length < 2) return;
    await api.post(`/sales/leads/${activeLead.id}/notes`, { note });
    setNote("");
    setNotice("Call note added.");
    await Promise.all([loadLead(activeLead.id), loadDashboard()]);
  }

  return (
    <AppLayout title="Sales Dashboard" subtitle="Work through today’s quota, follow-ups, and assigned leads.">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Call Target" value={dashboard?.quota.callsTarget ?? "-"} tone="forest" />
        <StatCard label="Calls Made" value={dashboard?.progress.callsCompleted ?? "-"} />
        <StatCard label="Lead Target" value={dashboard?.quota.leadsTarget ?? "-"} tone="gold" />
        <StatCard label="Leads Processed" value={dashboard?.progress.leadsProcessed ?? "-"} />
      </div>

      <section className="mt-6 grid gap-4 rounded-lg border border-line bg-white p-5 shadow-soft md:grid-cols-2">
        <div>
          <h2 className="text-lg font-bold">Today&apos;s Quota</h2>
          <div className="mt-4 space-y-4">
            <ProgressBar value={dashboard?.progress.callsCompleted || 0} max={dashboard?.quota.callsTarget || 0} />
            <ProgressBar value={dashboard?.progress.leadsProcessed || 0} max={dashboard?.quota.leadsTarget || 0} />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-bold">Pipeline Mix</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {phaseChart.map((item) => (
              <div key={item.phase} className="rounded border border-line p-3">
                <Badge phase={item.phase} />
                <p className="mt-2 text-2xl font-bold">{item._count.phase}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {notice ? <div className="mt-5 rounded border border-line bg-white p-3 text-sm text-forest">{notice}</div> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
        <section className="rounded-lg border border-line bg-white shadow-soft">
          <div className="border-b border-line p-5">
            <h2 className="text-lg font-bold">Today&apos;s To-Do List</h2>
            <p className="text-sm text-neutral-500">Follow-ups due today and new assigned leads.</p>
          </div>
          <div className="max-h-[680px] overflow-y-auto">
            {activeList.map((lead) => (
              <button
                key={lead.id}
                onClick={() => setActiveLeadId(lead.id)}
                className={`block w-full border-b border-line p-4 text-left hover:bg-neutral-50 ${activeLeadId === lead.id ? "bg-emerald-50" : "bg-white"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{lead.fullName}</p>
                    <p className="text-sm text-neutral-500">{lead.phoneNumber}</p>
                  </div>
                  <Badge phase={lead.phase} />
                </div>
                <p className="mt-2 text-xs text-neutral-500">Follow-up: {formatDate(lead.followUpDate)}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          {activeLead ? (
            <>
              <div className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{activeLead.fullName}</h2>
                  <p className="text-neutral-500">{activeLead.email}</p>
                  <p className="mt-1 font-semibold">{activeLead.phoneNumber}</p>
                </div>
                <Badge phase={activeLead.phase} />
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-semibold">Phase</label>
                    <div className="mt-2 flex gap-2">
                      <select value={phase} onChange={(event) => setPhase(event.target.value)} className="min-w-0 flex-1 rounded border border-line px-3 py-2">
                        {phaseOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button onClick={savePhase} className="inline-flex items-center gap-2 rounded bg-ink px-4 py-2 font-semibold text-white">
                        <Save size={17} />
                        Save
                      </button>
                    </div>
                  </div>

                  <form onSubmit={addNote}>
                    <label className="text-sm font-semibold">New Call Note</label>
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      rows="7"
                      className="mt-2 w-full resize-none rounded border border-line px-3 py-2 outline-none focus:border-forest"
                      placeholder="Summarize the call outcome, objections, next steps, or follow-up timing."
                    />
                    <button className="mt-3 inline-flex items-center gap-2 rounded bg-forest px-4 py-2 font-semibold text-white">
                      <PhoneCall size={18} />
                      Add Call Note
                    </button>
                  </form>
                </div>

                <div>
                  <h3 className="flex items-center gap-2 text-lg font-bold">
                    <CheckCircle2 size={19} />
                    Call History
                  </h3>
                  <div className="mt-3 space-y-3">
                    {activeLead.callNotes.length ? (
                      activeLead.callNotes.map((callNote) => (
                        <div key={callNote.id} className="rounded border border-line p-3">
                          <div className="flex items-center justify-between gap-3 text-xs text-neutral-500">
                            <span>{callNote.agent.name}</span>
                            <span>{formatDateTime(callNote.createdAt)}</span>
                          </div>
                          <p className="mt-2 text-sm leading-6">{callNote.note}</p>
                        </div>
                      ))
                    ) : (
                      <p className="rounded border border-dashed border-line p-5 text-sm text-neutral-500">No call notes yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-neutral-500">Select a lead to view details.</p>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
