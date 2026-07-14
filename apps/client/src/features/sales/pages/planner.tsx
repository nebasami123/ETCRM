import { useEffect, useMemo, useState } from "react";
import { BellRing, CalendarClock, CheckCircle2, ChevronRight, ClipboardCheck, PhoneCall, Plus, RefreshCw } from "lucide-react";
import { salesApi } from "../api";
import { getErrorMessage, toDateTimeLocalValue, formatDateTime } from "../../../lib/utils/format";
import { useToast } from "../../../hooks/use-toast";
import type { SalesTaskData, SalesTaskKind } from "../../../types";

const rangeOptions = [["today", "Today"], ["week", "This week"], ["month", "This month"], ["custom", "Custom"], ["lifetime", "Lifetime"]] as const;
const kindStyles: Record<SalesTaskKind, { label: string; tone: string; icon: typeof BellRing }> = {
  REMINDER: { label: "Reminder", tone: "bg-accent/10 text-accent", icon: BellRing },
  APPOINTMENT: { label: "Appointment", tone: "bg-success/10 text-success", icon: CalendarClock },
  FOLLOW_UP: { label: "Follow-up", tone: "bg-warning/10 text-warning", icon: PhoneCall }
};

export function SalesPlanner() {
  const { danger, success } = useToast();
  const [range, setRange] = useState("today");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [data, setData] = useState<SalesTaskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [dueAt, setDueAt] = useState("");

  const load = async () => {
    if (range === "custom" && (!start || !end)) return;
    try { setLoading(true); setData(await salesApi.getTasks({ range, start: start || undefined, end: end || undefined })); }
    catch (error) { danger(getErrorMessage(error, "Could not load your planner")); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [range, start, end]);

  const createReminder = async () => {
    if (!label.trim() || !dueAt) return;
    try { setAdding(true); await salesApi.createReminder({ label, note: note || undefined, dueAt: new Date(dueAt).toISOString() }); setLabel(""); setNote(""); setDueAt(""); success("Reminder added to your planner"); await load(); }
    catch (error) { danger(getErrorMessage(error, "Could not add reminder")); }
    finally { setAdding(false); }
  };
  const toggleReminder = async (id: string, complete: boolean) => { try { await salesApi.setReminderComplete(id, complete); await load(); } catch (error) { danger(getErrorMessage(error, "Could not update reminder")); } };
  const scheduled = useMemo(() => data?.tasks.filter((task) => !(task.kind === "REMINDER" && task.completedAt)) ?? [], [data]);

  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-2xl border border-separator bg-linear-to-br from-surface via-surface to-success/5 px-5 py-6 sm:px-7"><div className="absolute right-5 top-4 text-success/15"><ClipboardCheck className="h-28 w-28" /></div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-success">Personal command center</p><h1 className="mt-1 text-2xl font-black tracking-tight text-foreground">Planner & momentum</h1><p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">Appointments, follow-ups, daily call goals, and the promises you make to yourself—one calm, date-aware view.</p></section>
    <div className="flex flex-col gap-3 rounded-xl border border-separator bg-surface p-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex gap-1 overflow-x-auto">{rangeOptions.map(([value, labelText]) => <button key={value} onClick={() => setRange(value)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-[10px] font-bold ${range === value ? "bg-foreground text-background" : "text-muted hover:bg-default hover:text-foreground"}`}>{labelText}</button>)}</div>{range === "custom" && <div className="flex items-center gap-2"><input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="rounded-lg border border-field-border bg-field-background px-2 py-1.5 text-xs" /><span className="text-xs text-muted">to</span><input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="rounded-lg border border-field-border bg-field-background px-2 py-1.5 text-xs" /></div>}<button onClick={load} className="btn-interactive inline-flex items-center justify-center gap-1.5 rounded-lg border border-separator px-3 py-2 text-xs text-muted hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" />Refresh</button></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[["Open tasks", data?.stats.openTasks ?? 0, "text-accent"], ["Appointments", data?.stats.appointments ?? 0, "text-success"], ["Follow-ups", data?.stats.followUps ?? 0, "text-warning"], ["Reminders", data?.stats.reminders ?? 0, "text-blue-500"], ["Calls", `${data?.stats.callsCompleted ?? 0}/${data?.stats.callsTarget ?? 0}`, "text-foreground"]].map(([labelText, value, tone]) => <div key={String(labelText)} className="rounded-xl border border-separator bg-surface px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted">{labelText}</p><p className={`mt-1 text-xl font-black ${tone}`}>{value}</p></div>)}</div>
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="overflow-hidden rounded-xl border border-separator bg-surface"><div className="flex items-center justify-between border-b border-separator px-5 py-4"><div><h2 className="text-sm font-bold text-foreground">Your schedule</h2><p className="mt-0.5 text-[11px] text-muted">{rangeOptions.find(([value]) => value === range)?.[1]} commitments, ordered by time.</p></div><span className="rounded-full bg-default px-2 py-1 text-[10px] font-bold text-muted">{scheduled.length} active</span></div>{loading ? <p className="p-10 text-center text-xs text-muted">Loading your plan…</p> : scheduled.length === 0 ? <div className="p-12 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-success" /><p className="mt-3 text-sm font-bold text-foreground">You&apos;re clear here.</p><p className="mt-1 text-xs text-muted">Add a personal reminder or switch the date window.</p></div> : <div className="divide-y divide-separator">{scheduled.map((task) => { const style = kindStyles[task.kind]; const Icon = style.icon; return <div key={task.id} className="flex gap-3 px-5 py-4"><div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.tone}`}><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-xs font-bold text-foreground">{task.label}</p><span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${style.tone}`}>{style.label}</span></div>{task.note && <p className="mt-1 text-[11px] leading-relaxed text-muted">{task.note}</p>}<p className="mt-1.5 text-[10px] font-mono text-muted">{formatDateTime(task.dueAt)}</p></div>{task.kind === "REMINDER" ? <button onClick={() => toggleReminder(task.id, true)} className="btn-interactive self-center rounded-lg border border-separator p-2 text-muted hover:border-success hover:text-success" title="Complete reminder"><CheckCircle2 className="h-4 w-4" /></button> : <ChevronRight className="mt-2 h-4 w-4 text-muted" />}</div>; })}</div>}</section>
      <aside className="rounded-xl border border-separator bg-surface p-5"><div className="flex items-center gap-2"><div className="rounded-lg bg-accent/10 p-2 text-accent"><Plus className="h-4 w-4" /></div><div><h2 className="text-sm font-bold text-foreground">Set a reminder</h2><p className="text-[10px] text-muted">Private to your sales workspace.</p></div></div><div className="mt-5 space-y-3"><label className="block text-[10px] font-bold uppercase tracking-wider text-muted">Label<input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Send proposal draft" className="mt-1.5 w-full rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs text-foreground" /></label><label className="block text-[10px] font-bold uppercase tracking-wider text-muted">When<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-1.5 w-full rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs text-foreground" /></label><label className="block text-[10px] font-bold uppercase tracking-wider text-muted">Note <span className="normal-case text-muted">(optional)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="What should future-you know?" className="mt-1.5 w-full resize-none rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs text-foreground" /></label><button disabled={!label.trim() || !dueAt || adding} onClick={createReminder} className="btn-interactive w-full rounded-lg bg-accent px-4 py-2.5 text-xs font-bold text-accent-foreground disabled:opacity-40">{adding ? "Adding…" : "Add to planner"}</button></div></aside>
    </div>
  </div>;
}

export default SalesPlanner;
